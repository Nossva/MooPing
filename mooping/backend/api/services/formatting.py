"""Shapes repository rows into the JSON objects the app consumes. Shared by
several services so every endpoint returns animals/devices/alerts the same way."""
import json
from datetime import date

from api.entities import CATEGORY_BY_TYPE

# Typical drain of an AgroNeck collar; used to estimate "alcanza para unos N días".
BATTERY_DRAIN_PCT_PER_DAY = 3.0


def battery_days_left(battery_pct):
    if battery_pct is None:
        return None
    return int(battery_pct // BATTERY_DRAIN_PCT_PER_DAY)


def kmh(speed_mps):
    return None if speed_mps is None else round(speed_mps * 3.6, 1)


def compass(heading_deg):
    """'Este 94°' style label."""
    if heading_deg is None:
        return None
    names = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste']
    return f'{names[int(((heading_deg % 360) + 22.5) // 45) % 8]} {round(heading_deg)}°'


def age_months(birth_date):
    if birth_date is None:
        return None
    today = date.today()
    return (today.year - birth_date.year) * 12 + today.month - birth_date.month


def position(row):
    if row.get('lat') is None:
        return None
    return {'lat': row['lat'], 'lng': row['lng'], 'recorded_at': row.get('position_at')}


def geofence_status(inside):
    return 'unknown' if inside is None else ('inside' if inside else 'outside')


def animal(row):
    return {
        'id': row['id'],
        'name': row['name'],
        'tag_number': row['tag_number'],
        'lot': row['lot'],
        'species': row['species'],
        'sex': row['sex'],
        'breed': row['breed'],
        'birth_date': row['birth_date'],
        'age_months': age_months(row['birth_date']),
        'photo_url': row['photo_url'],
        'status': row['status'],
        'yard': {'id': row['yard_id'], 'name': row['yard_name']} if row['yard_id'] else None,
        'geofence_status': geofence_status(row['inside_geofence']),
        'distance_outside_m': row['distance_outside_m'] if row['inside_geofence'] is False else None,
        'health_status': 'alert' if row['open_alerts'] else 'optimal',
        'open_alerts': row['open_alerts'],
        'position': position(row),
        'speed_kmh': kmh(row['speed_mps']),
        'heading_deg': row['heading_deg'],
        'heading_label': compass(row['heading_deg']),
        'temp_body_c': row['temp_body_c'],
        'device': {
            'id': row['device_id'],
            'label': row['device_label'],
            'device_uid': row['device_uid'],
            'battery_pct': row['battery_pct'],
            'rssi_dbm': row['last_rssi_dbm'],
            'last_seen_at': row['last_seen_at'],
            'tx_interval_s': row['tx_interval_s'],
            'firmware_version': row['firmware_version'],
        } if row['device_id'] else None,
    }


def device_state(row):
    """Single label for the collar card: stock | no_signal | alert | low_battery | optimal."""
    if row['animal_id'] is None:
        return 'stock'
    if row['no_signal']:
        return 'no_signal'
    if row['geofence_alert_since'] is not None:
        return 'alert'
    if row['low_battery']:
        return 'low_battery'
    return 'optimal'


def device(row):
    return {
        'id': row['id'],
        'device_uid': row['device_uid'],
        'label': row['label'],
        'state': device_state(row),
        'hardware_version': row['hardware_version'],
        'firmware_version': row['firmware_version'],
        'battery_pct': row['battery_pct'],
        'battery_days_left': battery_days_left(row['battery_pct']),
        'battery_model': row['battery_model'],
        'rssi_dbm': row['last_rssi_dbm'],
        'tx_interval_s': row['tx_interval_s'],
        'last_seen_at': row['last_seen_at'],
        'storage_location': row['storage_location'],
        'geofence_alert_since': row['geofence_alert_since'],
        'animal': {
            'id': row['animal_id'],
            'name': row['animal_name'],
            'breed': row['animal_breed'],
            'lot': row['animal_lot'],
            'yard_name': row['yard_name'],
            'geofence_status': geofence_status(row['inside_geofence']),
        } if row['animal_id'] else None,
    }


def alert(row):
    return {
        'id': row['id'],
        'type': row['type'],
        'category': CATEGORY_BY_TYPE[row['type']],
        'severity': row['severity'],
        'status': row['status'],
        'message': row['message'],
        # Raw SQL returns jsonb as text (Django disables psycopg's JSON loader).
        'metadata': json.loads(row['metadata']) if isinstance(row['metadata'], str) else row['metadata'],
        'triggered_at': row['triggered_at'],
        'resolved_at': row['resolved_at'],
        'animal': {
            'id': row['animal_id'],
            'name': row['animal_name'],
            'tag_number': row['animal_tag'],
            'breed': row['animal_breed'],
            'lot': row['animal_lot'],
            'age_months': age_months(row['animal_birth_date']),
        } if row['animal_id'] else None,
        'device': {
            'id': row['device_id'],
            'label': row['device_label'],
            'device_uid': row['device_uid'],
            'battery_pct': row['device_battery_pct'],
            'battery_days_left': battery_days_left(row['device_battery_pct']),
            'rssi_dbm': row['device_rssi_dbm'],
            'last_seen_at': row['device_last_seen_at'],
        } if row['device_id'] else None,
        'yard': {'id': row['yard_id'], 'name': row['yard_name']} if row['yard_id'] else None,
        'assigned_to': {'id': row['assigned_to_id'], 'name': row['assigned_to_name']} if row['assigned_to_id'] else None,
        'resolved_by': {'id': row['resolved_by_id'], 'name': row['resolved_by_name']} if row['resolved_by_id'] else None,
        'position': {'lat': row['lat'], 'lng': row['lng']} if row['lat'] is not None else None,
        'speed_kmh': kmh(row['speed_mps']),
        'heading_label': compass(row['heading_deg']),
    }


def note(entity):
    return {
        'id': entity.id,
        'body': entity.body,
        'created_at': entity.created_at,
        'user': {'id': entity.user_id, 'name': entity.user.name} if entity.user_id else None,
    }
