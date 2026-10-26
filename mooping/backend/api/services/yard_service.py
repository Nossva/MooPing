from django.db import IntegrityError, transaction

from api.dto.response.yard_response import YardResponse
from api.repositories import yard_repository
from api.services.errors import Conflict, InvalidInput, NotFound


def _validate_polygon(boundary):
    if not isinstance(boundary, dict) or boundary.get('type') != 'Polygon':
        raise InvalidInput('boundary debe ser un GeoJSON de tipo Polygon.')
    rings = boundary.get('coordinates')
    if not rings or len(rings[0]) < 4 or rings[0][0] != rings[0][-1]:
        raise InvalidInput('El polígono necesita al menos 3 puntos y cerrar en el punto inicial.')


def list_yards(organization_id, scope=None):
    return [YardResponse.from_record(r) for r in yard_repository.list_by_org(organization_id, scope)]


def get_yard(organization_id, yard_id, scope=None):
    record = yard_repository.get(organization_id, yard_id, scope)
    if record is None:
        raise NotFound('Potrero no encontrado.')
    return YardResponse.from_record(record)


def create_yard(organization_id, request):
    """request: YardCreateRequest -> YardResponse"""
    _validate_polygon(request.boundary)
    try:
        with transaction.atomic():
            yard_id = yard_repository.create(organization_id, request.name, request.boundary)
    except IntegrityError:
        raise Conflict(f'Ya existe un potrero llamado "{request.name}".')
    return get_yard(organization_id, yard_id)


def update_yard(organization_id, yard_id, request):
    """request: YardUpdateRequest -> YardResponse"""
    get_yard(organization_id, yard_id)
    if request.boundary is not None:
        _validate_polygon(request.boundary)
    try:
        with transaction.atomic():
            yard_repository.update(organization_id, yard_id, name=request.name, boundary_geojson=request.boundary)
    except IntegrityError:
        raise Conflict(f'Ya existe un potrero llamado "{request.name}".')
    return get_yard(organization_id, yard_id)


def delete_yard(organization_id, yard_id):
    if not yard_repository.delete(organization_id, yard_id):
        raise NotFound('Potrero no encontrado.')
