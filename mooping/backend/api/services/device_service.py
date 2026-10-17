from datetime import date

from django.db import transaction

from api.repositories import animal_repository, device_repository
from api.services import formatting
from api.services.errors import Conflict, InvalidInput, NotFound

FILTERS = ('low_battery', 'alert', 'stock', 'no_signal', 'needs_attention')
EDITABLE_FIELDS = ('label', 'hardware_version', 'firmware_version', 'battery_model',
                   'tx_interval_s', 'storage_location')
MAINTENANCE_KINDS = ('battery_replacement', 'repair', 'inspection')


def _matches(row, filter_):
    assigned = row['animal_id'] is not None
    if filter_ == 'stock':
        return not assigned
    if filter_ == 'low_battery':
        return assigned and bool(row['low_battery'])
    if filter_ == 'no_signal':
        return assigned and bool(row['no_signal'])
    if filter_ == 'alert':
        return assigned and row['geofence_alert_since'] is not None
    # needs_attention: what the "Para revisar" cards show.
    return assigned and bool(row['low_battery'] or row['no_signal'])


def list_devices(organization_id, search=None, filter_=None):
    """Collar list plus the counters for the filter chips."""
    if filter_ and filter_ not in FILTERS:
        raise InvalidInput(f'filter inválido: {filter_}')
    rows = device_repository.list_rows(organization_id, search=search)
    counts = {'all': len(rows), **{f: sum(_matches(r, f) for r in rows) for f in FILTERS}}
    items = [formatting.device(r) for r in rows if filter_ is None or _matches(r, filter_)]
    return {'counts': counts, 'items': items}


def get_device(organization_id, device_id):
    row = device_repository.get_row(organization_id, device_id)
    if row is None:
        raise NotFound('Collar no encontrado.')
    result = formatting.device(row)
    result['maintenance'] = [
        {'id': t.id, 'kind': t.kind, 'scheduled_for': t.scheduled_for, 'status': t.status, 'notes': t.notes}
        for t in device_repository.list_maintenance(device_id)
    ]
    result['pending_commands'] = [
        {'id': c.id, 'command': c.command, 'created_at': c.created_at}
        for c in device_repository.pending_commands(device_id)
    ]
    return result


@transaction.atomic
def pair_device(organization_id, device_uid, **fields):
    """'Emparejar nuevo collar (NFC/QR)': claims a collar for the establecimiento.
    A collar that already sent data without an owner is claimed as is."""
    device_uid = (device_uid or '').strip()
    if not device_uid:
        raise InvalidInput('device_uid es obligatorio.')
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
def update_device(organization_id, device_id, user, **fields):
    device = device_repository.get(organization_id, device_id)
    if device is None:
        raise NotFound('Collar no encontrado.')
    unknown = set(fields) - set(EDITABLE_FIELDS)
    if unknown:
        raise InvalidInput(f'Campos no editables: {", ".join(sorted(unknown))}')
    interval = fields.get('tx_interval_s')
    if interval is not None and not 10 <= interval <= 3600:
        raise InvalidInput('tx_interval_s debe estar entre 10 y 3600 segundos.')
    if interval is not None and interval != device.tx_interval_s:
        device_repository.queue_command(device.id, 'set_interval', user.id, {'tx_interval_s': interval})
    device_repository.update(device, **fields)
    return get_device(organization_id, device_id)


@transaction.atomic
def assign_device(organization_id, device_id, animal_id):
    """'Vincular a un animal'."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    if animal_repository.get(organization_id, animal_id) is None:
        raise NotFound('Animal no encontrado.')
    if device_repository.active_assignment_for_device(device_id):
        raise Conflict('El collar ya está asignado a otro animal. Desvinculalo primero.')
    if device_repository.active_assignment_for_animal(animal_id):
        raise Conflict('El animal ya tiene un collar asignado. Desvinculalo primero.')
    device_repository.assign(device_id, animal_id)
    return get_device(organization_id, device_id)


@transaction.atomic
def unassign_device(organization_id, device_id, storage_location=None):
    device = device_repository.get(organization_id, device_id)
    if device is None:
        raise NotFound('Collar no encontrado.')
    assignment = device_repository.active_assignment_for_device(device_id)
    if assignment is None:
        raise Conflict('El collar no está asignado.')
    device_repository.unassign(assignment)
    if storage_location is not None:
        device_repository.update(device, storage_location=storage_location)
    return get_device(organization_id, device_id)


def ping_device(organization_id, device_id, user):
    """'Enviar ping forzado': queued until the Pi supports downlink."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    command = device_repository.queue_command(device_id, 'ping', user.id)
    return {'command_id': command.id, 'device_id': device_id, 'status': command.status}


def schedule_maintenance(organization_id, device_id, user, scheduled_for, kind='battery_replacement', notes=None):
    """'Agendar cambio de pila'."""
    if device_repository.get(organization_id, device_id) is None:
        raise NotFound('Collar no encontrado.')
    if kind not in MAINTENANCE_KINDS:
        raise InvalidInput(f'kind inválido: {kind}')
    if scheduled_for < date.today():
        raise InvalidInput('La fecha no puede ser anterior a hoy.')
    task = device_repository.create_maintenance(organization_id, device_id, scheduled_for, kind, notes, user.id)
    return {'id': task.id, 'device_id': device_id, 'kind': task.kind,
            'scheduled_for': task.scheduled_for, 'status': task.status, 'notes': task.notes}
