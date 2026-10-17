from datetime import datetime, timezone as dt_timezone

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from api.repositories import animal_repository, device_repository, gateway_repository, telemetry_repository
from api.services import alert_service
from api.services.errors import InvalidInput

# Accepted spellings for each field; today the Pi sends ID, LAT, LONG, TEMP.
_ALIASES = {
    'device_uid': ('ID', 'id', 'Id', 'device_uid'),
    'lat': ('LAT', 'lat', 'latitude', 'Lat', 'Latitude'),
    'lng': ('LONG', 'long', 'lng', 'lon', 'longitude', 'Long', 'Longitude'),
    'temp_body_c': ('TEMP', 'temp', 'temperature', 'temp_body_c'),
    'battery_pct': ('BAT', 'battery', 'battery_pct'),
    'rssi_dbm': ('RSSI', 'rssi', 'rssi_dbm'),
    'snr_db': ('SNR', 'snr', 'snr_db'),
    'activity': ('ACT', 'activity'),
    'rumination_min': ('RUM', 'rumination', 'rumination_min'),
    'speed_mps': ('SPEED', 'speed_mps'),
    'heading_deg': ('HEADING', 'heading', 'heading_deg'),
    'recorded_at': ('TS', 'ts', 'recorded_at'),
    'gateway_uid': ('GW', 'gateway', 'gateway_uid'),
}
_NUMERIC = ('lat', 'lng', 'temp_body_c', 'battery_pct', 'rssi_dbm', 'snr_db', 'activity',
            'rumination_min', 'speed_mps', 'heading_deg')

# Readings further apart than this are not used to derive speed/heading.
_MAX_MOTION_GAP_S = 3600


def _pick(raw, field):
    for key in _ALIASES[field]:
        if key in raw and raw[key] not in (None, ''):
            return raw[key]
    return None


def _parse_time(value):
    if value is None:
        return timezone.now()
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=dt_timezone.utc)
    parsed = parse_datetime(str(value))
    if parsed is None:
        raise InvalidInput(f'recorded_at inválido: {value}')
    return parsed if parsed.tzinfo else timezone.make_aware(parsed)


def normalize(raw):
    """Payload from the Pi -> dict with canonical names and numeric values."""
    if not isinstance(raw, dict):
        raise InvalidInput('Cada lectura debe ser un objeto JSON.')
    reading = {field: _pick(raw, field) for field in _ALIASES}
    if not reading['device_uid']:
        raise InvalidInput('Falta el ID del collar.')
    reading['device_uid'] = str(reading['device_uid']).strip()
    for field in _NUMERIC:
        if reading[field] is not None:
            try:
                reading[field] = float(reading[field])
            except (TypeError, ValueError):
                raise InvalidInput(f'{field} no es numérico: {reading[field]}')
    # NEO-6M reports 0,0 while it has no fix.
    if reading['lat'] in (None, 0.0) or reading['lng'] in (None, 0.0):
        reading['lat'] = reading['lng'] = None
    elif not (-90 <= reading['lat'] <= 90 and -180 <= reading['lng'] <= 180):
        raise InvalidInput('Coordenadas fuera de rango.')
    reading['recorded_at'] = _parse_time(reading['recorded_at'])
    return reading


@transaction.atomic
def ingest(raw, gateway_uid=None):
    """Stores one reading and evaluates alerts. Unknown collars are registered
    without an establecimiento until someone pairs them."""
    reading = normalize(raw)
    gateway_uid = reading.pop('gateway_uid') or gateway_uid

    device = device_repository.get_by_uid(reading['device_uid'])
    if device is None:
        device = device_repository.create(reading['device_uid'], label=reading['device_uid'])
    animal = animal_repository.get_by_device(device.id)
    gateway = gateway_repository.get_by_uid(gateway_uid) if gateway_uid else None

    lat, lng = reading['lat'], reading['lng']
    if lat is not None and reading['speed_mps'] is None:
        motion = telemetry_repository.motion_since_last(device.id, lng, lat, reading['recorded_at'])
        if motion and 0 < motion['seconds'] <= _MAX_MOTION_GAP_S:
            reading['speed_mps'] = motion['distance_m'] / motion['seconds']
            if motion['distance_m'] >= 1 and reading['heading_deg'] is None:
                reading['heading_deg'] = motion['heading_deg']

    reading_id = telemetry_repository.insert(
        device.id, animal.id if animal else None, gateway.id if gateway else None,
        reading['recorded_at'], lng, lat,
        temp_body_c=reading['temp_body_c'], battery_pct=reading['battery_pct'],
        rssi_dbm=round(reading['rssi_dbm']) if reading['rssi_dbm'] is not None else None,
        snr_db=reading['snr_db'], activity=reading['activity'],
        rumination_min=reading['rumination_min'], speed_mps=reading['speed_mps'],
        heading_deg=reading['heading_deg'],
    )

    alerts_created = []
    if animal is not None and device.organization_id is not None:
        alerts_created = alert_service.evaluate_reading(
            animal, device, reading['recorded_at'], lng, lat, reading['temp_body_c'], reading['battery_pct'],
        )

    return {
        'reading_id': reading_id,
        'device_id': device.id,
        'animal_id': animal.id if animal else None,
        'alerts_created': alerts_created,
    }


def ingest_many(items, gateway_uid=None):
    """Accepts one object or a list; returns per-item results (errors included)."""
    items = items if isinstance(items, list) else [items]
    results = []
    for item in items:
        try:
            results.append({'ok': True, **ingest(item, gateway_uid)})
        except InvalidInput as error:
            results.append({'ok': False, 'error': error.message})
    return results
