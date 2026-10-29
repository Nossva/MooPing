from django.conf import settings
from django.utils import timezone

from api.entities import CATEGORY_BY_TYPE, Alert, AlertNote
from api.repositories.db import fetch_all, fetch_one
from api.repositories.records import AlertRecord
from api.repositories.scope import alert_q, alert_sql

# One row per alert with the animal, collar, potrero, assignee and last position.
_ALERT_ROWS = """
    SELECT al.id, al.type, al.severity, al.status, al.message, al.metadata,
           al.triggered_at, al.resolved_at, al.updated_at,
           al.animal_id, a.name AS animal_name, a.tag_number AS animal_tag, a.breed AS animal_breed,
           a.lot AS animal_lot, a.birth_date AS animal_birth_date,
           al.device_id, d.label AS device_label, d.device_uid, d.last_seen_at AS device_last_seen_at,
           al.yard_id, y.name AS yard_name,
           al.assigned_to AS assigned_to_id, ua.name AS assigned_to_name,
           al.resolved_by AS resolved_by_id, ur.name AS resolved_by_name,
           ST_Y(alp.location::geometry) AS lat, ST_X(alp.location::geometry) AS lng,
           alp.speed_mps, alp.heading_deg,
           CASE al.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END AS urgency_rank
    FROM alerts al
    LEFT JOIN animals a ON a.id = al.animal_id
    LEFT JOIN devices d ON d.id = al.device_id
    LEFT JOIN yards y ON y.id = al.yard_id
    LEFT JOIN users ua ON ua.id = al.assigned_to
    LEFT JOIN users ur ON ur.id = al.resolved_by
    LEFT JOIN animal_last_position alp ON alp.animal_id = al.animal_id
    WHERE al.organization_id = %s
"""


def _types_for(category):
    return [t for t, c in CATEGORY_BY_TYPE.items() if c == category]


def list_rows(organization_id, status=None, category=None, resolved_today=False,
              animal_id=None, device_id=None, sort='urgency', limit=200, scope=None):
    """status: 'open' (not resolved) | 'resolved' | a concrete status | None (all)."""
    where, params = alert_sql(scope, 'q.animal_id', 'q.yard_id')
    sql = 'SELECT * FROM (' + _ALERT_ROWS + ') q WHERE true' + where
    params = [organization_id, *params]
    if status == 'open':
        sql += " AND q.status <> 'resolved'"
    elif status:
        sql += ' AND q.status = %s'
        params.append(status)
    if category:
        sql += ' AND q.type = ANY(%s)'
        params.append(_types_for(category))
    if resolved_today:
        sql += " AND q.resolved_at >= (date_trunc('day', now() AT TIME ZONE %s) AT TIME ZONE %s)"
        params += [settings.TIME_ZONE, settings.TIME_ZONE]
    if animal_id:
        sql += ' AND q.animal_id = %s'
        params.append(animal_id)
    if device_id:
        sql += ' AND q.device_id = %s'
        params.append(device_id)
    if sort == 'urgency':
        sql += ' ORDER BY q.urgency_rank, q.triggered_at DESC'
    elif resolved_today:
        sql += ' ORDER BY q.resolved_at DESC'
    else:
        sql += ' ORDER BY q.triggered_at DESC'
    sql += ' LIMIT %s'
    params.append(limit)
    return fetch_all(sql, params, AlertRecord)


def get_row(organization_id, alert_id, scope=None):
    where, params = alert_sql(scope, 'q.animal_id', 'q.yard_id')
    return fetch_one('SELECT * FROM (' + _ALERT_ROWS + ') q WHERE q.id = %s' + where,
                     [organization_id, alert_id, *params], AlertRecord)


def get(organization_id, alert_id, scope=None):
    return Alert.objects.filter(alert_q(scope), organization_id=organization_id, id=alert_id).first()


def open_counts_by_type(organization_id, scope=None):
    """{type: count} of alerts that are not resolved."""
    where, params = alert_sql(scope, 'animal_id', 'yard_id')
    rows = fetch_all(
        """SELECT type, count(*) AS n FROM alerts
           WHERE organization_id = %s AND status <> 'resolved'""" + where + ' GROUP BY type',
        [organization_id, *params],
    )
    return {r['type']: r['n'] for r in rows}


def count_open(organization_id, severity=None, status=None, scope=None):
    qs = Alert.objects.filter(alert_q(scope), organization_id=organization_id).exclude(status='resolved')
    if severity:
        qs = qs.filter(severity=severity)
    if status:
        qs = qs.filter(status=status)
    return qs.count()


def find_open(type, animal_id=None, device_id=None):
    qs = Alert.objects.filter(type=type).exclude(status='resolved')
    if animal_id:
        qs = qs.filter(animal_id=animal_id)
    if device_id:
        qs = qs.filter(device_id=device_id)
    return qs.order_by('-triggered_at').first()


def create(organization_id, type, severity, message, metadata, animal_id=None, device_id=None,
           yard_id=None, triggered_at=None):
    return Alert.objects.create(
        organization_id=organization_id, type=type, severity=severity, message=message,
        metadata=metadata, animal_id=animal_id, device_id=device_id, yard_id=yard_id,
        triggered_at=triggered_at or timezone.now(),
    )


def update(alert, **fields):
    for name, value in fields.items():
        setattr(alert, name, value)
    alert.save()
    return alert


def resolve(alert, user_id=None, metadata=None, resolved_at=None):
    alert.status = 'resolved'
    alert.resolved_at = resolved_at or timezone.now()
    alert.resolved_by_id = user_id
    if metadata:
        alert.metadata = {**alert.metadata, **metadata}
    alert.save()
    return alert


def list_notes(alert_id):
    return list(AlertNote.objects.filter(alert_id=alert_id).select_related('user').order_by('created_at'))


def create_note(alert_id, user_id, body):
    return AlertNote.objects.select_related('user').get(
        id=AlertNote.objects.create(alert_id=alert_id, user_id=user_id, body=body).id
    )
