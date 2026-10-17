from django.utils import timezone

from api.entities import Gateway
from api.repositories.db import fetch_all
from api.repositories.records import GatewayRecord

ONLINE_MINUTES = 10

_SELECT = """
    SELECT g.id, g.gateway_uid, g.name, g.kind, g.power_source, g.battery_pct, g.radio,
           g.coverage_ha, g.last_seen_at,
           ST_Y(g.location::geometry) AS lat, ST_X(g.location::geometry) AS lng,
           (g.last_seen_at IS NOT NULL AND g.last_seen_at >= now() - make_interval(mins => %s)) AS online
    FROM gateways g
"""


def list_by_org(organization_id):
    return fetch_all(_SELECT + ' WHERE g.organization_id = %s ORDER BY g.kind, g.name',
                     [ONLINE_MINUTES, organization_id], GatewayRecord)


def get_by_uid(gateway_uid):
    return Gateway.objects.filter(gateway_uid=gateway_uid).first()


def create(organization_id, gateway_uid, **fields):
    return Gateway.objects.create(organization_id=organization_id, gateway_uid=gateway_uid, **fields)


def touch(gateway_id):
    Gateway.objects.filter(id=gateway_id).update(last_seen_at=timezone.now())
