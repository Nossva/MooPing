"""Domain rules shared by services and DTO mappers (no I/O)."""

# type -> category shown in the app chips (Criticas / Sanitarias / Equipos).
CATEGORY_BY_TYPE = {
    'geofence_exit': 'critical',
    'fever': 'sanitary',
    'low_activity': 'sanitary',
    'low_battery': 'equipment',
    'no_signal': 'equipment',
}

# Typical drain of an AgroNeck collar; used to estimate "alcanza para unos N días".
BATTERY_DRAIN_PCT_PER_DAY = 3.0


def battery_days_left(battery_pct):
    if battery_pct is None:
        return None
    return int(battery_pct // BATTERY_DRAIN_PCT_PER_DAY)


def device_state(assigned, no_signal, has_geofence_alert, low_battery):
    """Single state for a collar card: stock | no_signal | alert | low_battery | optimal."""
    if not assigned:
        return 'stock'
    if no_signal:
        return 'no_signal'
    if has_geofence_alert:
        return 'alert'
    if low_battery:
        return 'low_battery'
    return 'optimal'
