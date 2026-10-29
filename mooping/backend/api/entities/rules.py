"""Domain rules shared by services and DTO mappers (no I/O)."""
import re

# type -> category shown in the app chips (Criticas / Sanitarias / Equipos).
CATEGORY_BY_TYPE = {
    'geofence_exit': 'critical',
    'fever': 'sanitary',
    'low_activity': 'sanitary',
    'no_signal': 'equipment',
}

def device_state(assigned, no_signal, has_geofence_alert):
    """Single state for a collar card: stock | no_signal | alert | optimal."""
    if not assigned:
        return 'stock'
    if no_signal:
        return 'no_signal'
    if has_geofence_alert:
        return 'alert'
    return 'optimal'


# lora_receiver.c sends "COLLAR-%u" with the uint16 id_collar the firmware has.
_COLLAR_UID = re.compile(r'^\s*(?:collar|c)?\s*[-_ #]?\s*0*(\d{1,5})\s*$', re.IGNORECASE)
COLLAR_ID_MAX = 65535


def collar_uid(raw):
    """'84', '084', 'C-084', 'collar 84', 'COLLAR-84' -> 'COLLAR-84' (what the Pi
    sends). None if it isn't a collar number."""
    match = _COLLAR_UID.match(str(raw or ''))
    if not match or int(match.group(1)) > COLLAR_ID_MAX:
        return None
    return f'COLLAR-{int(match.group(1))}'


def default_collar_label(device_uid):
    """'COLLAR-84' -> 'C-084', the label printed on the collar."""
    number = device_uid.removeprefix('COLLAR-')
    return f'C-{int(number):03d}' if number.isdigit() else device_uid
