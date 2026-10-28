from django.db import transaction

from api.dto.response.alert_response import (
    AlertDetailResponse,
    AlertResponse,
    AlertSummaryResponse,
    NoteResponse,
)
from api.entities import CATEGORY_BY_TYPE, battery_days_left
from api.repositories import (
    alert_repository,
    device_repository,
    organization_repository,
    telemetry_repository,
    user_repository,
    yard_repository,
)
from api.services import access_service
from api.services.errors import Forbidden, InvalidInput, NotFound

STATUSES = ('pending', 'assigned', 'in_progress', 'resolved')
CATEGORIES = ('critical', 'sanitary', 'equipment')


# ---------------------------------------------------------------- queries

def list_alerts(organization_id, request, scope=None):
    """request: AlertListRequest -> list[AlertResponse]"""
    if request.status and request.status not in ('open', 'all', *STATUSES):
        raise InvalidInput(f'status inválido: {request.status}')
    if request.category and request.category not in CATEGORIES:
        raise InvalidInput(f'category inválida: {request.category}')
    if request.since and request.since != 'today':
        raise InvalidInput("since solo acepta 'today'.")
    records = alert_repository.list_rows(
        organization_id,
        status=None if request.status == 'all' else request.status,
        category=request.category,
        resolved_today=request.since == 'today',
        animal_id=request.animal_id,
        device_id=request.device_id,
        sort=request.sort,
        scope=scope,
        **({'limit': request.limit} if request.limit else {}),
    )
    return [AlertResponse.from_record(r) for r in records]


def get_alert(organization_id, alert_id, scope=None):
    record = alert_repository.get_row(organization_id, alert_id, scope)
    if record is None:
        raise NotFound('Alerta no encontrada.')
    return AlertDetailResponse.build(record, alert_repository.list_notes(alert_id))


def summary(organization_id, scope=None):
    """Counters for the Alertas chips and header."""
    by_type = alert_repository.open_counts_by_type(organization_id, scope)
    by_category = {c: 0 for c in CATEGORIES}
    for type_, n in by_type.items():
        by_category[CATEGORY_BY_TYPE[type_]] += n
    return AlertSummaryResponse(
        open_total=sum(by_type.values()),
        by_category=by_category,
        by_type=by_type,
        critical_unattended=alert_repository.count_open(organization_id, severity='critical', status='pending',
                                                        scope=scope),
        last_packet_at=telemetry_repository.last_packet_at(organization_id),
    )


# ---------------------------------------------------------------- actions

def update_alert(organization_id, alert_id, user, request, is_owner=False, scope=None):
    """request: AlertUpdateRequest. Moves an alert through
    pendiente -> asignada -> en curso -> resuelta. Only the owner assigns
    alerts to someone else."""
    alert = alert_repository.get(organization_id, alert_id, scope)
    if alert is None:
        raise NotFound('Alerta no encontrada.')
    status, assigned_to = request.status, request.assigned_to
    if status is not None and status not in STATUSES:
        raise InvalidInput(f'status inválido: {status}')

    fields = {}
    if assigned_to is not None:
        if assigned_to != user.id and not is_owner:
            raise Forbidden('Solo el dueño puede asignar alertas a otra persona.')
        assignee = user_repository.get_membership(assigned_to, organization_id)
        if assignee is None or not assignee.active:
            raise InvalidInput('El usuario asignado no pertenece al establecimiento.')
        assignee_access = access_service.for_member(organization_id, assigned_to, assignee.role)
        if (not assignee_access.can('alertas')
                or alert_repository.get(organization_id, alert_id, assignee_access.scope) is None):
            raise InvalidInput('Esa persona no tiene permiso para ver esta alerta.')
        fields['assigned_to_id'] = assigned_to
        if status is None and alert.status == 'pending':
            fields['status'] = 'assigned'

    if status == 'resolved':
        if fields:
            alert_repository.update(alert, **fields)
        alert_repository.resolve(alert, user_id=user.id)
    else:
        if status is not None:
            fields['status'] = status
            fields['resolved_at'] = None
            fields['resolved_by_id'] = None
        if fields:
            alert_repository.update(alert, **fields)
    return get_alert(organization_id, alert_id, scope)


def list_notes(organization_id, alert_id, scope=None):
    if alert_repository.get(organization_id, alert_id, scope) is None:
        raise NotFound('Alerta no encontrada.')
    return [NoteResponse.from_entity(n) for n in alert_repository.list_notes(alert_id)]


def add_note(organization_id, alert_id, user, request, scope=None):
    """request: NoteCreateRequest -> NoteResponse"""
    if alert_repository.get(organization_id, alert_id, scope) is None:
        raise NotFound('Alerta no encontrada.')
    body = (request.body or '').strip()
    if not body:
        raise InvalidInput('La nota está vacía.')
    return NoteResponse.from_entity(alert_repository.create_note(alert_id, user.id, body))


# ---------------------------------------------------------------- rules

def evaluate_reading(animal, device, recorded_at, lng, lat, temp_body_c, battery_pct):
    """Opens/closes alerts after a new reading. Returns created alert ids."""
    org = organization_repository.get(animal.organization_id)
    created = []

    def open_alert(type_, severity, message, metadata):
        created.append(alert_repository.create(
            org.id, type_, severity, message, metadata, animal_id=animal.id, device_id=device.id,
            yard_id=animal.yard_id, triggered_at=recorded_at,
        ).id)

    # A reading means the collar is back: close "sin señal".
    open_no_signal = alert_repository.find_open('no_signal', device_id=device.id)
    if open_no_signal:
        alert_repository.resolve(open_no_signal, metadata={'resolution': 'back_online'}, resolved_at=recorded_at)

    if animal.yard_id and lat is not None:
        state = yard_repository.point_status(animal.yard_id, lng, lat)
        open_geo = alert_repository.find_open('geofence_exit', animal_id=animal.id)
        if state and not state.inside:
            metadata = {'distance_m': state.distance_m, 'lat': lat, 'lng': lng}
            message = f'{animal.name} fuera del perímetro, a {round(state.distance_m)} m del límite.'
            if open_geo:
                alert_repository.update(open_geo, message=message, metadata={**open_geo.metadata, **metadata})
            else:
                open_alert('geofence_exit', 'critical', message, metadata)
        elif state and open_geo:
            alert_repository.resolve(open_geo, metadata={'resolution': 'back_inside'}, resolved_at=recorded_at)

    if temp_body_c is not None and temp_body_c >= org.fever_threshold_c:
        open_fever = alert_repository.find_open('fever', animal_id=animal.id)
        peak = max(temp_body_c, open_fever.metadata.get('temp_c', 0)) if open_fever else temp_body_c
        metadata = {'temp_c': peak, 'limit_c': org.fever_threshold_c}
        message = (f'{animal.name}: temperatura {peak:.1f} °C, por encima del límite '
                   f'{org.fever_threshold_c:.1f} °C.')
        if open_fever:
            alert_repository.update(open_fever, message=message, metadata={**open_fever.metadata, **metadata})
        else:
            open_alert('fever', 'warning', message, metadata)

    if battery_pct is not None:
        open_battery = alert_repository.find_open('low_battery', device_id=device.id)
        days_left = battery_days_left(battery_pct)
        if battery_pct < org.low_battery_pct and open_battery is None:
            open_alert('low_battery', 'warning',
                       f'Batería al {round(battery_pct)}%, alcanza para unos {days_left} días.',
                       {'battery_pct': battery_pct, 'days_left': days_left})
        elif battery_pct >= org.low_battery_pct and open_battery:
            alert_repository.resolve(open_battery, metadata={'resolution': 'battery_replaced'},
                                     resolved_at=recorded_at)

    return created


@transaction.atomic
def check_no_signal():
    """Opens a 'sin señal' alert for assigned collars that stopped reporting.
    Called periodically by the telemetry listener."""
    created = []
    for row in device_repository.offline_assigned_devices():
        if alert_repository.find_open('no_signal', device_id=row.device_id):
            continue
        last = device_repository.last_location(row.device_id)
        created.append(alert_repository.create(
            row.organization_id, 'no_signal', 'warning',
            'Sin señal. Última posición guardada.',
            {'last_seen_at': row.last_seen_at.isoformat() if row.last_seen_at else None,
             'lat': last.lat if last else None, 'lng': last.lng if last else None},
            animal_id=row.animal_id, device_id=row.device_id, yard_id=row.yard_id,
        ).id)
    return created
