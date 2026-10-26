import json

from api.entities import Yard
from api.repositories.db import execute, fetch_all, fetch_one, fetch_value
from api.repositories.records import PointStatusRecord, YardRecord
from api.repositories.scope import yard_sql

_SELECT = """
    SELECT y.id, y.name,
           ROUND((ST_Area(y.boundary) / 10000)::numeric, 1)::float AS area_ha,
           ST_AsGeoJSON(y.boundary)::json AS boundary,
           (SELECT count(*) FROM animals a
             WHERE a.yard_id = y.id AND a.status = 'active') AS animal_count
    FROM yards y
"""


def list_by_org(organization_id, scope=None):
    where, params = yard_sql(scope, 'y.id')
    return fetch_all(_SELECT + ' WHERE y.organization_id = %s' + where + ' ORDER BY y.name',
                     [organization_id, *params], YardRecord)


def get(organization_id, yard_id, scope=None):
    where, params = yard_sql(scope, 'y.id')
    return fetch_one(_SELECT + ' WHERE y.organization_id = %s AND y.id = %s' + where,
                     [organization_id, yard_id, *params], YardRecord)


def existing_ids(organization_id, yard_ids):
    """The ids in `yard_ids` that are potreros of this organization."""
    return set(Yard.objects.filter(organization_id=organization_id, id__in=yard_ids).values_list('id', flat=True))


def create(organization_id, name, boundary_geojson):
    """boundary_geojson: GeoJSON Polygon dict (lng, lat order)."""
    return execute(
        """INSERT INTO yards (organization_id, name, boundary)
           VALUES (%s, %s, ST_GeomFromGeoJSON(%s)::geography)
           RETURNING id""",
        [organization_id, name, json.dumps(boundary_geojson)],
    )


def update(organization_id, yard_id, name=None, boundary_geojson=None):
    if name is not None:
        execute('UPDATE yards SET name = %s WHERE organization_id = %s AND id = %s',
                [name, organization_id, yard_id])
    if boundary_geojson is not None:
        execute(
            """UPDATE yards SET boundary = ST_GeomFromGeoJSON(%s)::geography
               WHERE organization_id = %s AND id = %s""",
            [json.dumps(boundary_geojson), organization_id, yard_id],
        )


def delete(organization_id, yard_id):
    return execute('DELETE FROM yards WHERE organization_id = %s AND id = %s', [organization_id, yard_id])


def point_status(yard_id, lng, lat):
    """distance_m: meters outside the boundary (0 if inside)."""
    return fetch_one(
        """SELECT ST_Covers(boundary, ST_MakePoint(%s, %s)::geography) AS inside,
                  ROUND(ST_Distance(boundary, ST_MakePoint(%s, %s)::geography)::numeric)::float AS distance_m
           FROM yards WHERE id = %s""",
        [lng, lat, lng, lat, yard_id],
        PointStatusRecord,
    )


def total_area_ha(organization_id):
    return fetch_value(
        """SELECT COALESCE(ROUND((SUM(ST_Area(boundary)) / 10000)::numeric), 0)::float
           FROM yards WHERE organization_id = %s""",
        [organization_id],
    )
