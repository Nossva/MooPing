from api.dto.response.gateway_response import GatewayResponse, HeardDeviceResponse
from api.repositories import gateway_repository
from api.services.errors import Conflict, InvalidInput, NotFound

# "Collares escuchados" on each gateway card: readings of the last day.
HEARD_HOURS = 24


def list_gateways(organization_id, scope=None):
    heard = gateway_repository.heard_counts(organization_id, HEARD_HOURS, scope)
    return [GatewayResponse.from_record(r, heard.get(r.id, 0))
            for r in gateway_repository.list_by_org(organization_id)]


def get_gateway(organization_id, gateway_id, scope=None):
    row = gateway_repository.get_row(organization_id, gateway_id)
    if row is None:
        raise NotFound('Estación no encontrada.')
    heard = gateway_repository.heard_counts(organization_id, HEARD_HOURS, scope)
    return GatewayResponse.from_record(row, heard.get(row.id, 0))


def create_gateway(organization_id, request):
    """request: GatewayCreateRequest. 'Agregar estación': registers the GATEWAY_ID the
    Pi sends ("GW"), so its readings count for this establecimiento."""
    gateway_uid = request.gateway_uid.strip().upper()
    if not gateway_uid:
        raise InvalidInput('Escribí el ID de la estación (el GATEWAY_ID de la Pi), ej: AGROBOT-03.')
    existing = gateway_repository.get_by_uid(gateway_uid)
    if existing is not None:
        if existing.organization_id == organization_id:
            raise Conflict('La estación ya está en este establecimiento.')
        raise Conflict('La estación pertenece a otro establecimiento.')
    fields = request.fields_to_set()
    fields.setdefault('name', gateway_uid)
    gateway = gateway_repository.create(organization_id, gateway_uid, **fields)
    return get_gateway(organization_id, gateway.id)


def update_gateway(organization_id, gateway_id, request):
    """request: GatewayUpdateRequest (only the sent fields change)."""
    gateway = gateway_repository.get(organization_id, gateway_id)
    if gateway is None:
        raise NotFound('Estación no encontrada.')
    changes = request.changes()
    if 'name' in changes and not (changes['name'] or '').strip():
        raise InvalidInput('El nombre no puede quedar vacío.')
    gateway_repository.update(gateway, **changes)
    return get_gateway(organization_id, gateway_id)


def delete_gateway(organization_id, gateway_id):
    gateway = gateway_repository.get(organization_id, gateway_id)
    if gateway is None:
        raise NotFound('Estación no encontrada.')
    gateway_repository.delete(gateway)


def list_heard_devices(organization_id, gateway_id, scope=None):
    """-> list[HeardDeviceResponse]"""
    if gateway_repository.get(organization_id, gateway_id) is None:
        raise NotFound('Estación no encontrada.')
    rows = gateway_repository.list_heard_devices(organization_id, gateway_id, HEARD_HOURS, scope)
    return [HeardDeviceResponse.from_record(r) for r in rows]
