from datetime import date

from django.db import transaction

from api.dto.response.command_response import CommandQueuedResponse
from api.dto.response.device_response import (
    DeviceDetailResponse,
    DeviceListResponse,
    DeviceResponse,
    MaintenanceResponse,
)
from api.repositories import animal_repository, device_repository
from api.services.errors import Conflict, InvalidInput, NotFound

FILTERS = ('low_battery', 'alert', 'stock', 'no_signal', 'needs_attention')
MAINTENANCE_KINDS = ('battery_replacement', 'repair', 'inspection')


def _matches(record, filter_):
    assigned = record.animal_id is not None
    if filter_ == 'stock':
        return not assigned
    if filter_ == 'low_battery':
        return assigned and record.low_battery
    if filter_ == 'no_signal':
        return assigned and record.no_signal
    if filter_ == 'alert':
        return assigned and record.geofence_alert_since is not None
    # needs_attention: what the "Para revisar" cards show.
    return assigned and (record.low_battery or record.no_signal)


def list_devices(organization_id, request):
    """request: DeviceListRequest -> DeviceListResponse (items + chip counters)"""
    if request.filter and request.filter not in FILTERS:
        raise InvalidInput(f'filter inválido: {request.filter}')
    records = device_repository.list_rows(organization_id, search=request.search)
    counts = {'all': len(records), **{f: sum(_matches(r, f) for r in records) for f in FILTERS}}
    items = [DeviceResponse.from_record(r) for r in records if request.filter is None or _matches(r, request.filter)]
    return DeviceListResponse(counts, items)


def get_device(organization_id, device_id):
    record = device_repository.get_row(organization_id, device_id)
    if record is None:
        raise NotFound('Collar no encontrado.')
    return DeviceDetailResponse.build(
        record, device_repository.list_maintenance(device_id), device_repository.pending_commands(device_id)
    )


@transaction.atomic
def pair_device(organization_id, request):
    """request: DevicePairRequest. 'Emparejar nuevo collar (NFC/QR)': claims a
    collar for the establecimiento; one that already sent data without an owner
    is claimed as is."""
    device_uid = (request.device_uid or '').strip()
    if not device_uid:
        raise InvalidInput('device_uid es obligatorio.')
    fields = request.fields_to_set()
    device = device_repository.get_by_uid(device_uid)
    if device is not None:
        if device.organization_id == organization_id:
            raise Conflict('El collar ya está emparejado en este establecimiento.')
        if device.organization_id is not None:
            raise Conflict('El collar pertenece a otro establecimiento.')
        device_repository.update(device, organization_id=organization_id, **fields)
    else:
        fields.setdefault('label', device_uid)
        device = device_repository.create(device_uid, organization_id=organization_id, **fields)
    return get_device(organization_id, device.id)


@transaction.atomic
def update_device(organization_id, device_id, user, request):
    """request: DeviceUpdateRequest (only the sent fields change)."""
    device = device_repository.get(organization_id, device_id)
    if device is None:
        raise NotFound('Collar no encontrado.')
    changes = request.changes()
    interval = changes.get('tx_interval_s')
    if interval is not None and not 10 <= interval <= 3600:
        raise InvalidInput('tx_interval_s debe estar entre 10 y 3600 segundos.')
    if interval is not None and interval != device.tx_interval_s:
        device_repository.queue_command(device.id, 'set_interval', user.id, {'tx_interval_s': interval})
    device_repository.update(device, **changes)
    return get_device(organization_id, device_id)


@transaction.atomic
def assign_device(organization_id, device_id, request):
    """request: AssignRequest. 'Vincular a un animal'."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    if animal_repository.get(organization_id, request.animal_id) is None:
        raise NotFound('Animal no encontrado.')
    if device_repository.active_assignment_for_device(device_id):
        raise Conflict('El collar ya está asignado a otro animal. Desvinculalo primero.')
    if device_repository.active_assignment_for_animal(request.animal_id):
        raise Conflict('El animal ya tiene un collar asignado. Desvinculalo primero.')
    device_repository.assign(device_id, request.animal_id)
    return get_device(organization_id, device_id)


@transaction.atomic
def unassign_device(organization_id, device_id, request):
    """request: UnassignRequest."""
    device = device_repository.get(organization_id, device_id)
    if device is None:
        raise NotFound('Collar no encontrado.')
    assignment = device_repository.active_assignment_for_device(device_id)
    if assignment is None:
        raise Conflict('El collar no está asignado.')
    device_repository.unassign(assignment)
    if request.storage_location is not None:
        device_repository.update(device, storage_location=request.storage_location)
    return get_device(organization_id, device_id)


def ping_device(organization_id, device_id, user):
    """'Enviar ping forzado': queued until the Pi supports downlink."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    return CommandQueuedResponse.from_entity(device_repository.queue_command(device_id, 'ping', user.id))


def schedule_maintenance(organization_id, device_id, user, request):
    """request: MaintenanceRequest. 'Agendar cambio de pila'."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    if request.kind not in MAINTENANCE_KINDS:
        raise InvalidInput(f'kind inválido: {request.kind}')
    if request.scheduled_for < date.today():
        raise InvalidInput('La fecha no puede ser anterior a hoy.')
    task = device_repository.create_maintenance(organization_id, device_id, request.scheduled_for,
                                                request.kind, request.notes, user.id)
    return MaintenanceResponse.from_entity(task)
