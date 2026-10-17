from django.db import IntegrityError, transaction

from api.repositories import yard_repository
from api.services.errors import Conflict, InvalidInput, NotFound


def _validate_polygon(boundary):
    if not isinstance(boundary, dict) or boundary.get('type') != 'Polygon':
        raise InvalidInput('boundary debe ser un GeoJSON de tipo Polygon.')
    rings = boundary.get('coordinates')
    if not rings or len(rings[0]) < 4 or rings[0][0] != rings[0][-1]:
        raise InvalidInput('El polígono necesita al menos 3 puntos y cerrar en el punto inicial.')


def list_yards(organization_id):
    return yard_repository.list_by_org(organization_id)


def get_yard(organization_id, yard_id):
    yard = yard_repository.get(organization_id, yard_id)
    if yard is None:
        raise NotFound('Potrero no encontrado.')
    return yard


def create_yard(organization_id, name, boundary):
    _validate_polygon(boundary)
    try:
        with transaction.atomic():
            yard_id = yard_repository.create(organization_id, name, boundary)
    except IntegrityError:
        raise Conflict(f'Ya existe un potrero llamado "{name}".')
    return get_yard(organization_id, yard_id)


def update_yard(organization_id, yard_id, name=None, boundary=None):
    get_yard(organization_id, yard_id)
    if boundary is not None:
        _validate_polygon(boundary)
    try:
        with transaction.atomic():
            yard_repository.update(organization_id, yard_id, name=name, boundary_geojson=boundary)
    except IntegrityError:
        raise Conflict(f'Ya existe un potrero llamado "{name}".')
    return get_yard(organization_id, yard_id)


def delete_yard(organization_id, yard_id):
    if not yard_repository.delete(organization_id, yard_id):
        raise NotFound('Potrero no encontrado.')
