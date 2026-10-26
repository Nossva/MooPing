from django.conf import settings

from api.entities import Animal, AnimalDevice
from api.repositories.db import fetch_all, fetch_one, fetch_value
from api.repositories.records import AnimalRecord, ReportingDayRecord, TrackPointRecord
from api.repositories.scope import animal_q, animal_sql

# One row per animal with its active collar, last position and geofence state.
_ANIMAL_ROWS = """
    SELECT a.id, a.name, a.tag_number, a.lot, a.species, a.sex, a.breed, a.birth_date,
           a.photo_url, a.notes, a.status, a.created_at,
           a.yard_id, y.name AS yard_name,
           d.id AS device_id, d.label AS device_label, d.device_uid, d.battery_pct,
           d.last_rssi_dbm, d.last_seen_at, d.tx_interval_s, d.firmware_version,
           ST_Y(alp.location::geometry) AS lat, ST_X(alp.location::geometry) AS lng,
           alp.recorded_at AS position_at, alp.speed_mps, alp.heading_deg,
           alp.temp_body_c, alp.activity,
           CASE WHEN alp.location IS NULL OR y.id IS NULL THEN NULL
                ELSE ST_Covers(y.boundary, alp.location) END AS inside_geofence,
           CASE WHEN alp.location IS NULL OR y.id IS NULL THEN NULL
                ELSE ROUND(ST_Distance(y.boundary, alp.location)::numeric)::float END AS distance_outside_m,
           (SELECT count(*) FROM alerts al
             WHERE al.animal_id = a.id AND al.status <> 'resolved') AS open_alerts
    FROM animals a
    LEFT JOIN yards y ON y.id = a.yard_id
    LEFT JOIN animal_devices ad ON ad.animal_id = a.id AND ad.unassigned_at IS NULL
    LEFT JOIN devices d ON d.id = ad.device_id
    LEFT JOIN animal_last_position alp ON alp.animal_id = a.id
    WHERE a.organization_id = %s
"""


def list_rows(organization_id, search=None, yard_id=None, geofence=None, status='active', limit=500, scope=None):
    """geofence: 'inside' | 'outside' | None."""
    where, params = animal_sql(scope, 'q.id')
    sql = 'SELECT * FROM (' + _ANIMAL_ROWS + ') q WHERE true' + where
    params = [organization_id, *params]
    if status:
        sql += ' AND q.status = %s'
        params.append(status)
    if yard_id:
        sql += ' AND q.yard_id = %s'
        params.append(yard_id)
    if geofence == 'inside':
        sql += ' AND q.inside_geofence IS TRUE'
    elif geofence == 'outside':
        sql += ' AND q.inside_geofence IS FALSE'
    if search:
        sql += """ AND (q.name ILIKE %s OR q.tag_number ILIKE %s OR q.lot ILIKE %s
                        OR q.device_label ILIKE %s OR q.device_uid ILIKE %s)"""
        params += [f'%{search}%'] * 5
    sql += ' ORDER BY q.name LIMIT %s'
    params.append(limit)
    return fetch_all(sql, params, AnimalRecord)


def get_row(organization_id, animal_id, scope=None):
    where, params = animal_sql(scope, 'q.id')
    return fetch_one('SELECT * FROM (' + _ANIMAL_ROWS + ') q WHERE q.id = %s' + where,
                     [organization_id, animal_id, *params], AnimalRecord)


def get(organization_id, animal_id, scope=None):
    return Animal.objects.filter(animal_q(scope), organization_id=organization_id, id=animal_id).first()


def existing_ids(organization_id, animal_ids):
    """The ids in `animal_ids` that are animals of this organization."""
    return set(Animal.objects.filter(organization_id=organization_id, id__in=animal_ids).values_list('id', flat=True))


def create(organization_id, **fields):
    return Animal.objects.create(organization_id=organization_id, **fields)


def update(animal, **fields):
    for name, value in fields.items():
        setattr(animal, name, value)
    animal.save()
    return animal


def get_by_device(device_id):
    """Animal currently wearing the collar, or None."""
    link = AnimalDevice.objects.select_related('animal').filter(device_id=device_id, unassigned_at__isnull=True).first()
    return link.animal if link else None


def distance_today_m(animal_id):
    """Sum of distances between consecutive readings since local midnight."""
    return fetch_value(
        """SELECT COALESCE(SUM(ST_Distance(location, prev)), 0)::float
           FROM (SELECT location, LAG(location) OVER (ORDER BY recorded_at) AS prev
                 FROM telemetry_readings
                 WHERE animal_id = %s AND location IS NOT NULL
                   AND recorded_at >= (date_trunc('day', now() AT TIME ZONE %s) AT TIME ZONE %s)) t
           WHERE prev IS NOT NULL""",
        [animal_id, settings.TIME_ZONE, settings.TIME_ZONE],
    )


def rumination_minutes(animal_id, hours):
    """Total rumination minutes reported in the last `hours`, None if the collar
    does not report rumination."""
    return fetch_value(
        """SELECT SUM(rumination_min)::float FROM telemetry_readings
           WHERE animal_id = %s AND recorded_at >= now() - make_interval(hours => %s)""",
        [animal_id, hours],
    )


def track(organization_id, animal_id, hours):
    return fetch_all(
        """SELECT t.recorded_at, ST_Y(t.location::geometry) AS lat, ST_X(t.location::geometry) AS lng,
                  t.speed_mps, t.heading_deg, t.temp_body_c
           FROM telemetry_readings t
           JOIN animals a ON a.id = t.animal_id
           WHERE a.organization_id = %s AND t.animal_id = %s AND t.location IS NOT NULL
             AND t.recorded_at >= now() - make_interval(hours => %s)
           ORDER BY t.recorded_at""",
        [organization_id, animal_id, hours],
        TrackPointRecord,
    )


def count_active(organization_id, scope=None):
    return Animal.objects.filter(animal_q(scope), organization_id=organization_id, status='active').count()


def count_reporting(organization_id, minutes, scope=None):
    """Active animals whose collar sent data in the last `minutes`."""
    where, params = animal_sql(scope, 'a.id')
    return fetch_value(
        """SELECT count(*) FROM animals a
           JOIN animal_last_position alp ON alp.animal_id = a.id
           WHERE a.organization_id = %s AND a.status = 'active'
             AND alp.recorded_at >= now() - make_interval(mins => %s)""" + where,
        [organization_id, minutes, *params],
    )


def reporting_series(organization_id, days, scope=None):
    """Distinct animals with at least one reading per local day."""
    where, params = animal_sql(scope, 'a.id')
    return fetch_all(
        """SELECT d::date AS date,
                  (SELECT count(DISTINCT t.animal_id)
                     FROM telemetry_readings t JOIN animals a ON a.id = t.animal_id
                    WHERE a.organization_id = %s""" + where + """
                      AND t.recorded_at >= (d AT TIME ZONE %s)
                      AND t.recorded_at <  ((d + interval '1 day') AT TIME ZONE %s)) AS reporting
           FROM generate_series((now() AT TIME ZONE %s)::date - (%s - 1),
                                (now() AT TIME ZONE %s)::date, interval '1 day') AS d
           ORDER BY d""",
        [organization_id, *params, settings.TIME_ZONE, settings.TIME_ZONE, settings.TIME_ZONE, days,
         settings.TIME_ZONE],
        ReportingDayRecord,
    )
