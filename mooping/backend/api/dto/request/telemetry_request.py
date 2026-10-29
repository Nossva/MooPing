import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone as dt_timezone

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from api.dto.request.base import DtoValidationError

# Accepted spellings for each field; today the Pi sends ID, LAT, LONG, TEMP.
# Anything else in the JSON (RSSI, SNR, BAT, KEY...) is ignored.
_ALIASES = {
    'device_uid': ('ID', 'id', 'Id', 'device_uid'),
    'lat': ('LAT', 'lat', 'latitude', 'Lat', 'Latitude'),
    'lng': ('LONG', 'long', 'lng', 'lon', 'longitude', 'Long', 'Longitude'),
    'temp_body_c': ('TEMP', 'temp', 'temperature', 'temp_body_c'),
    'activity': ('ACT', 'activity'),
    'rumination_min': ('RUM', 'rumination', 'rumination_min'),
    'speed_mps': ('SPEED', 'speed_mps'),
    'heading_deg': ('HEADING', 'heading', 'heading_deg'),
    'recorded_at': ('TS', 'ts', 'recorded_at'),
    'gateway_uid': ('GW', 'gateway', 'gateway_uid'),
}
_NUMERIC = ('lat', 'lng', 'temp_body_c', 'activity', 'rumination_min', 'speed_mps', 'heading_deg')
# Plausible values per sensor field. A value outside (or NaN/inf, e.g. a failed
# sensor) is dropped: the rest of the reading, position included, is kept.
# NaN in the database would break every screen that serializes it (strict JSON).
_RANGES = {
    'temp_body_c': (0, 60),       # LM35/MLX glitches (85, 127...) must not open fever alerts
    'activity': (0, None),
    'rumination_min': (0, None),
    'speed_mps': (0, 100),
    'heading_deg': (0, 360),
}


# recorded_at accepted as sent within this window around the server clock.
_MAX_FUTURE = timedelta(minutes=5)
_MAX_PAST = timedelta(days=7)
# Epoch numbers above this are milliseconds (in seconds it would be year 5138).
_EPOCH_MS_FROM = 1e11


def _in_range(name, value):
    if not math.isfinite(value):
        return False
    low, high = _RANGES.get(name, (None, None))
    return (low is None or value >= low) and (high is None or value <= high)


def _pick(raw, name):
    for key in _ALIASES[name]:
        if key in raw and raw[key] not in (None, ''):
            return raw[key]
    return None


def _to_datetime(value):
    """TS as sent (epoch seconds or milliseconds, or ISO 8601) -> aware datetime, or None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value)
    try:
        if isinstance(value, (int, float)):
            if value > _EPOCH_MS_FROM:
                value /= 1000
            return datetime.fromtimestamp(value, tz=dt_timezone.utc)
        parsed = parse_datetime(str(value))
    except (ValueError, OverflowError, OSError):  # year out of range, NaN, 2026-13-45...
        return None
    if parsed is None:
        return None
    return parsed if parsed.tzinfo else timezone.make_aware(parsed)


def _parse_time(value):
    """A clock far off (a Pi without RTC boots in 1970 or ahead) gets the
    arrival time: a future recorded_at would freeze devices.last_seen_at and
    animal_last_position (both keep the newest) until that date."""
    now = timezone.now()
    if value is None:
        return now
    parsed = _to_datetime(value)
    if parsed is None:
        raise DtoValidationError(f'recorded_at inválido: {value}')
    if not now - _MAX_PAST <= parsed <= now + _MAX_FUTURE:
        return now
    return parsed


@dataclass
class TelemetryReadingRequest:
    """One reading from a collar, already normalized."""
    device_uid: str
    recorded_at: datetime
    lat: float | None = None
    lng: float | None = None
    temp_body_c: float | None = None
    activity: float | None = None
    rumination_min: float | None = None
    speed_mps: float | None = None
    heading_deg: float | None = None
    gateway_uid: str | None = None

    @classmethod
    def from_payload(cls, raw, gateway_uid=None):
        """JSON object from the Pi -> request. Raises DtoValidationError."""
        if not isinstance(raw, dict):
            raise DtoValidationError('Cada lectura debe ser un objeto JSON.')
        values = {name: _pick(raw, name) for name in _ALIASES}
        if not values['device_uid']:
            raise DtoValidationError('Falta el ID del collar.')
        values['device_uid'] = str(values['device_uid']).strip()
        for name in _NUMERIC:
            if values[name] is not None:
                try:
                    values[name] = float(values[name])
                except (TypeError, ValueError):
                    raise DtoValidationError(f'{name} no es numérico: {values[name]}')
                if not _in_range(name, values[name]):
                    values[name] = None
        # NEO-6M reports 0,0 while it has no fix (NaN coordinates: same, no fix).
        if values['lat'] in (None, 0.0) or values['lng'] in (None, 0.0):
            values['lat'] = values['lng'] = None
        elif not (-90 <= values['lat'] <= 90 and -180 <= values['lng'] <= 180):
            raise DtoValidationError('Coordenadas fuera de rango.')
        values['recorded_at'] = _parse_time(values['recorded_at'])
        values['gateway_uid'] = values['gateway_uid'] or gateway_uid
        return cls(**values)
