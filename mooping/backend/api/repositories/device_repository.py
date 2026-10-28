from django.db import IntegrityError, transaction
from django.utils import timezone

from api.entities import AnimalDevice, Device, DeviceCommand, MaintenanceTask
from api.repositories.db import fetch_all, fetch_one
from api.repositories.records import DetectedDeviceRecord, DeviceRecord, LocationRecord, OfflineDeviceRecord
from api.repositories.scope import animal_sql

# One row per collar with the animal it is on and its open alerts.
_DEVICE_ROWS = """
    SELECT d.id, d.device_uid, d.label, d.hardware_version, d.firmware_version,
           d.battery_model, d.tx_interval_s, d.storage_location, d.battery_pct,
           d.last_rssi_dbm, d.last_seen_at, d.created_at,
           a.id AS animal_id, a.name AS animal_name, a.breed AS animal_breed,
           a.lot AS animal_lot, y.name AS yard_name,
           CASE WHEN alp.location IS NULL OR y.id IS NULL THEN NULL
                ELSE ST_Covers(y.boundary, alp.location) END AS inside_geofence,
           geo.triggered_at AS geofence_alert_since,
           (d.last_seen_at IS NULL OR d.last_seen_at < now() - make_interval(mins => o.no_signal_minutes))
               AS no_signal,
           (d.battery_pct IS NOT NULL AND d.battery_pct < o.low_battery_pct) AS low_battery
    FROM devices d
    JOIN organizations o ON o.id = d.organization_id
    LEFT JOIN animal_devices ad ON ad.device_id = d.id AND ad.unassigned_at IS NULL
    LEFT JOIN animals a ON a.id = ad.animal_id
    LEFT JOIN yards y ON y.id = a.yard_id
    LEFT JOIN animal_last_position alp ON alp.animal_id = a.id
    LEFT JOIN LATERAL (
        SELECT al.triggered_at FROM alerts al
        WHERE al.animal_id = a.id AND al.type = 'geofence_exit' AND al.status <> 'resolved'
        ORDER BY al.triggered_at DESC LIMIT 1
    ) geo ON true
    WHERE d.organization_id = %s
"""


def list_rows(organization_id, search=None, limit=1000, scope=None):
    """With a scope: only collars on a visible animal (no stock)."""
    where, params = animal_sql(scope, 'q.animal_id')
    sql = 'SELECT * FROM (' + _DEVICE_ROWS + ') q WHERE true' + where
    params = [organization_id, *params]
    if search:
        sql += """ AND (q.label ILIKE %s OR q.device_uid ILIKE %s OR q.animal_name ILIKE %s
                        OR q.animal_lot ILIKE %s)"""
        params += [f'%{search}%'] * 4
    sql += ' ORDER BY q.label NULLS LAST, q.device_uid LIMIT %s'
    params.append(limit)
    return fetch_all(sql, params, DeviceRecord)


def get_row(organization_id, device_id, scope=None):
    where, params = animal_sql(scope, 'q.animal_id')
    return fetch_one('SELECT * FROM (' + _DEVICE_ROWS + ') q WHERE q.id = %s' + where,
                     [organization_id, device_id, *params], DeviceRecord)


def get(organization_id, device_id):
    return Device.objects.filter(organization_id=organization_id, id=device_id).first()


def get_by_uid(device_uid):
    return Device.objects.filter(device_uid=device_uid).first()


def list_detected(organization_id, days, limit):
    """Collars without an establecimiento whose last reading came in through one
    of this establecimiento's gateways (the Pi sends "GW"), seen in the last `days`."""
    return fetch_all(
        """SELECT d.id, d.device_uid, d.last_seen_at, d.battery_pct, d.last_rssi_dbm, g.name AS gateway_name
           FROM devices d
           JOIN LATERAL (
               SELECT r.gateway_id FROM telemetry_readings r
               WHERE r.device_id = d.id ORDER BY r.recorded_at DESC LIMIT 1
           ) last ON true
           JOIN gateways g ON g.id = last.gateway_id
           WHERE d.organization_id IS NULL AND g.organization_id = %s
             AND d.last_seen_at >= now() - make_interval(days => %s)
           ORDER BY d.last_seen_at DESC LIMIT %s""",
        [organization_id, days, limit], DetectedDeviceRecord,
    )


def get_or_create_by_uid(device_uid, **fields):
    """Safe when two readings of a new collar arrive at once (the TCP listener
    runs one thread per connection): the loser of the race reads the winner's row."""
    device = get_by_uid(device_uid)
    if device is not None:
        return device
    try:
        with transaction.atomic():
            return Device.objects.create(device_uid=device_uid, **fields)
    except IntegrityError:
        return get_by_uid(device_uid)


def create(device_uid, organization_id=None, **fields):
    return Device.objects.create(device_uid=device_uid, organization_id=organization_id, **fields)


def delete_by_uids(device_uids):
    Device.objects.filter(device_uid__in=device_uids).delete()


def update(device, **fields):
    for name, value in fields.items():
        setattr(device, name, value)
    device.save()
    return device


def active_assignment_for_device(device_id):
    return AnimalDevice.objects.filter(device_id=device_id, unassigned_at__isnull=True).first()


def active_assignment_for_animal(animal_id):
    return AnimalDevice.objects.filter(animal_id=animal_id, unassigned_at__isnull=True).first()


def assign(device_id, animal_id):
    return AnimalDevice.objects.create(device_id=device_id, animal_id=animal_id)


def unassign(assignment):
    assignment.unassigned_at = timezone.now()
    assignment.save(update_fields=['unassigned_at'])


def queue_command(device_id, command, user_id=None, payload=None):
    return DeviceCommand.objects.create(device_id=device_id, command=command,
                                        created_by_id=user_id, payload=payload or {})


def pending_commands(device_id):
    return list(DeviceCommand.objects.filter(device_id=device_id, status='queued').order_by('created_at'))


def create_maintenance(organization_id, device_id, scheduled_for, kind, notes, user_id):
    return MaintenanceTask.objects.create(
        organization_id=organization_id, device_id=device_id, scheduled_for=scheduled_for,
        kind=kind, notes=notes, created_by_id=user_id,
    )


def list_maintenance(device_id):
    return list(MaintenanceTask.objects.filter(device_id=device_id).order_by('-scheduled_for'))


def offline_assigned_devices():
    """Assigned collars (any organization) silent for longer than their
    organization's no_signal_minutes."""
    return fetch_all(
        """SELECT d.id AS device_id, d.organization_id, d.last_seen_at, ad.animal_id, a.yard_id
           FROM devices d
           JOIN organizations o ON o.id = d.organization_id
           JOIN animal_devices ad ON ad.device_id = d.id AND ad.unassigned_at IS NULL
           JOIN animals a ON a.id = ad.animal_id
           WHERE d.last_seen_at < now() - make_interval(mins => o.no_signal_minutes)""",
        record=OfflineDeviceRecord,
    )


def last_location(device_id):
    """Position of the collar's last reading with a position."""
    return fetch_one(
        """SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, recorded_at
           FROM telemetry_readings WHERE device_id = %s AND location IS NOT NULL
           ORDER BY recorded_at DESC LIMIT 1""",
        [device_id],
        LocationRecord,
    )
