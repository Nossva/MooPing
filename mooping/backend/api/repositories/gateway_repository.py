from django.utils import timezone

from api.entities import Gateway
from api.repositories.db import fetch_all, fetch_one
from api.repositories.records import GatewayRecord, HeardCountRecord, HeardDeviceRecord
from api.repositories.scope import animal_sql

ONLINE_MINUTES = 10

_SELECT = """
    SELECT g.id, g.gateway_uid, g.name, g.kind, g.power_source, g.radio,
           g.coverage_ha, g.last_seen_at,
           ST_Y(g.location::geometry) AS lat, ST_X(g.location::geometry) AS lng,
           (g.last_seen_at IS NOT NULL AND g.last_seen_at >= now() - make_interval(mins => %s)) AS online
    FROM gateways g
"""

# Collars heard through a gateway lately: this establecimiento's and unclaimed ones,
# never another establecimiento's. The collar is not tied to a gateway; only each
# reading says which one received it.
_HEARD = """
    SELECT r.gateway_id, d.id, d.device_uid, d.label, (d.organization_id IS NOT NULL) AS owned,
           a.id AS animal_id, a.name AS animal_name, a.tag_number AS animal_tag,
           MAX(r.recorded_at) AS last_heard_at
    FROM telemetry_readings r
    JOIN gateways g ON g.id = r.gateway_id
    JOIN devices d ON d.id = r.device_id
    LEFT JOIN animal_devices ad ON ad.device_id = d.id AND ad.unassigned_at IS NULL
    LEFT JOIN animals a ON a.id = ad.animal_id
    WHERE g.organization_id = %s AND r.recorded_at >= now() - make_interval(hours => %s)
      AND (d.organization_id = g.organization_id OR d.organization_id IS NULL)
"""
_HEARD_GROUP = ' GROUP BY r.gateway_id, d.id, a.id'


def list_by_org(organization_id):
    return fetch_all(_SELECT + ' WHERE g.organization_id = %s ORDER BY g.kind, g.name',
                     [ONLINE_MINUTES, organization_id], GatewayRecord)


def get_row(organization_id, gateway_id):
    return fetch_one(_SELECT + ' WHERE g.organization_id = %s AND g.id = %s',
                     [ONLINE_MINUTES, organization_id, gateway_id], GatewayRecord)


def get(organization_id, gateway_id):
    return Gateway.objects.filter(organization_id=organization_id, id=gateway_id).first()


def get_by_uid(gateway_uid):
    return Gateway.objects.filter(gateway_uid=gateway_uid).first()


def create(organization_id, gateway_uid, **fields):
    return Gateway.objects.create(organization_id=organization_id, gateway_uid=gateway_uid, **fields)


def update(gateway, **fields):
    for name, value in fields.items():
        setattr(gateway, name, value)
    gateway.save(update_fields=list(fields))


def delete(gateway):
    """Readings keep their data with gateway_id NULL (ON DELETE SET NULL)."""
    gateway.delete()


def touch(gateway_id):
    Gateway.objects.filter(id=gateway_id).update(last_seen_at=timezone.now())


def heard_counts(organization_id, hours, scope=None):
    """{gateway_id: collars heard in the last `hours`}. With a scope: only collars on a visible animal."""
    where, params = animal_sql(scope, 'q.animal_id')
    rows = fetch_all(
        'SELECT q.gateway_id, COUNT(*)::int AS devices FROM (' + _HEARD + _HEARD_GROUP + ') q WHERE true'
        + where + ' GROUP BY q.gateway_id',
        [organization_id, hours, *params], HeardCountRecord,
    )
    return {r.gateway_id: r.devices for r in rows}


def list_heard_devices(organization_id, gateway_id, hours, scope=None):
    where, params = animal_sql(scope, 'q.animal_id')
    return fetch_all(
        'SELECT q.id, q.device_uid, q.label, q.owned, q.animal_id, q.animal_name, q.animal_tag, q.last_heard_at'
        ' FROM (' + _HEARD + ' AND r.gateway_id = %s' + _HEARD_GROUP + ') q WHERE true' + where
        + ' ORDER BY q.last_heard_at DESC',
        [organization_id, hours, gateway_id, *params], HeardDeviceRecord,
    )
