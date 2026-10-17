from django.db import transaction

from api.entities import CATEGORY_BY_TYPE
from api.repositories import (
    alert_repository,
    device_repository,
    organization_repository,
    telemetry_repository,
    user_repository,
    yard_repository,
)
from api.services import formatting
from api.services.errors import InvalidInput, NotFound

STATUSES = ('pending', 'assigned', 'in_progress', 'resolved')
CATEGORIES = ('critical', 'sanitary', 'equipment')


# ---------------------------------------------------------------- queries

def list_alerts(organization_id, status=None, category=None, since=None, sort='urgency',
                animal_id=None, device_id=None):
    if status and status not in ('open', 'all', *STATUSES):
        raise InvalidInput(f'status inválido: {status}')
    if category and category not in CATEGORIES:
        raise InvalidInput(f'category inválida: {category}')
    if since and since != 'today':
        raise InvalidInput("since solo acepta 'today'.")
    rows = alert_repository.list_rows(
        organization_id,
        status=None if status == 'all' else status,
        category=category,
        resolved_today=since == 'today',
        animal_id=animal_id,
        device_id=device_id,
        sort=sort,
    )
    return [formatting.alert(r) for r in rows]


def get_alert(organization_id, alert_id):
    row = alert_repository.get_row(organization_id, alert_id)
    if row is None:
        raise NotFound('Alerta no encontrada.')
    result = formatting.alert(row)
    result['notes'] = [formatting.note(n) for n in alert_repository.list_notes(alert_id)]
    return result


def summary(organization_id):
    """Counters for the Alertas chips and header."""
    by_type = alert_repository.open_counts_by_type(organization_id)
    by_category = {c: 0 for c in CATEGORIES}
    for type_, n in by_type.items():
        by_category[CATEGORY_BY_TYPE[type_]] += n
    return {
        'open_total': sum(by_type.values()),
        'by_category': by_category,
        'by_type': by_type,
        'critical_unattended': alert_repository.count_open(organization_id, severity='critical', status='pending'),
        'last_packet_at': telemetry_repository.last_packet_at(organization_id),
    }


# ---------------------------------------------------------------- actions

def update_alert(organization_id, alert_id, user, status=None, assigned_to=None):
    """Moves an alert through pendiente -> asignada -> en curso -> resuelta."""
    alert = alert_repository.get(organization_id, alert_id)
    if alert is None:
        raise NotFound('Alerta no encontrada.')
    if status is not None and status not in STATUSES:
        raise InvalidInput(f'status inválido: {status}')

    fields = {}
    if assigned_to is not None:
        if user_repository.get_membership(assigned_to, organization_id) is None:
            raise InvalidInput('El usuario asignado no pertenece al establecimiento.')
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
    return get_alert(organization_id, alert_id)


def list_notes(organization_id, alert_id):
    if alert_repository.get(organization_id, alert_id) is None:
        raise NotFound('Alerta no encontrada.')
    return [formatting.note(n) for n in alert_repository.list_notes(alert_id)]


def add_note(organization_id, alert_id, user, body):
    if alert_repository.get(organization_id, alert_id) is None:
        raise NotFound('Alerta no encontrada.')
    if not body or not body.strip():
        raise InvalidInput('La nota está vacía.')
    return formatting.note(alert_repository.create_note(alert_id, user.id, body.strip()))


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
        if state and not state['inside']:
            metadata = {'distance_m': state['distance_m'], 'lat': lat, 'lng': lng}
            message = f'{animal.name} fuera del perímetro, a {round(state["distance_m"])} m del límite.'
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
        days_left = formatting.battery_days_left(battery_pct)
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
        if alert_repository.find_open('no_signal', device_id=row['device_id']):
            continue
        last = device_repository.last_location(row['device_id']) or {}
        created.append(alert_repository.create(
            row['organization_id'], 'no_signal', 'warning',
            'Sin señal. Última posición guardada.',
            {'last_seen_at': row['last_seen_at'].isoformat() if row['last_seen_at'] else None,
             'lat': last.get('lat'), 'lng': last.get('lng')},
            animal_id=row['animal_id'], device_id=row['device_id'], yard_id=row['yard_id'],
        ).id)
    return created
