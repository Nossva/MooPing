from django.db import IntegrityError, transaction

from api.repositories import alert_repository, animal_repository, device_repository, organization_repository, yard_repository
from api.services import formatting
from api.services.errors import Conflict, InvalidInput, NotFound

EDITABLE_FIELDS = ('name', 'tag_number', 'lot', 'species', 'sex', 'breed', 'birth_date',
                   'photo_url', 'notes', 'status', 'yard_id')
NORMAL_TEMP_MIN_C = 38.0


def _check_yard(organization_id, yard_id):
    if yard_id is not None and yard_repository.get(organization_id, yard_id) is None:
        raise InvalidInput('El potrero no existe en este establecimiento.')


def list_animals(organization_id, search=None, yard_id=None, geofence=None, status='active'):
    if geofence not in (None, 'inside', 'outside'):
        raise InvalidInput("geofence debe ser 'inside' u 'outside'.")
    rows = animal_repository.list_rows(organization_id, search=search, yard_id=yard_id,
                                       geofence=geofence, status=status)
    return [formatting.animal(r) for r in rows]


def list_positions(organization_id, yard_id=None, geofence=None):
    """Light payload for the map markers."""
    if geofence not in (None, 'inside', 'outside'):
        raise InvalidInput("geofence debe ser 'inside' u 'outside'.")
    rows =animal_repository.list_rows(organization_id, yard_id=yard_id, geofence=geofence)
    return [
        {
            'id': r['id'],
            'name': r['name'],
            'lat': r['lat'],
            'lng': r['lng'],
            'recorded_at': r['position_at'],
            'geofence_status': formatting.geofence_status(r['inside_geofence']),
            'has_alert': r['open_alerts'] > 0,
        }
        for r in rows if r['lat'] is not None
    ]


def get_animal(organization_id, animal_id):
    """Ficha shown in Monitoreo: vitals, activity, position, collar, open alerts."""
    row = animal_repository.get_row(organization_id, animal_id)
    if row is None:
        raise NotFound('Animal no encontrado.')
    org = organization_repository.get(organization_id)
    result = formatting.animal(row)
    result['notes'] = row['notes']
    result['temp_range_c'] = {'min': NORMAL_TEMP_MIN_C, 'max': org.fever_threshold_c}
    result['temp_in_range'] = (
        None if row['temp_body_c'] is None
        else NORMAL_TEMP_MIN_C <= row['temp_body_c'] <= org.fever_threshold_c
    )
    result['activity_today_km'] = round(animal_repository.distance_today_m(animal_id) / 1000, 2)
    result['rumination_4h_min'] = animal_repository.rumination_minutes(animal_id, 4)
    result['open_alerts'] = [
        formatting.alert(r) for r in alert_repository.list_rows(organization_id, status='open', animal_id=animal_id)
    ]
    return result


def create_animal(organization_id, **fields):
    if not fields.get('name'):
        raise InvalidInput('El nombre es obligatorio.')
    _check_yard(organization_id, fields.get('yard_id'))
    try:
        with transaction.atomic():
            animal = animal_repository.create(organization_id, **fields)
    except IntegrityError:
        raise Conflict('Ya existe un animal con esa caravana.')
    return get_animal(organization_id, animal.id)


def update_animal(organization_id, animal_id, **fields):
    animal = animal_repository.get(organization_id, animal_id)
    if animal is None:
        raise NotFound('Animal no encontrado.')
    unknown = set(fields) - set(EDITABLE_FIELDS)
    if unknown:
        raise InvalidInput(f'Campos no editables: {", ".join(sorted(unknown))}')
    if 'yard_id' in fields:
        _check_yard(organization_id, fields['yard_id'])
    try:
        with transaction.atomic():
            animal_repository.update(animal, **fields)
    except IntegrityError:
        raise Conflict('Ya existe un animal con esa caravana.')
    return get_animal(organization_id, animal_id)


def get_track(organization_id, animal_id, hours=24):
    if animal_repository.get(organization_id, animal_id) is None:
        raise NotFound('Animal no encontrado.')
    if not 1 <= hours <= 24 * 30:
        raise InvalidInput('hours debe estar entre 1 y 720.')
    points = animal_repository.track(organization_id, animal_id, hours)
    return {
        'animal_id': animal_id,
        'hours': hours,
        'points': [
            {**p, 'speed_kmh': formatting.kmh(p.pop('speed_mps'))} for p in points
        ],
    }


def trigger_alarm(organization_id, animal_id, user):
    """'Alarma sonora': queues a command for the animal's collar."""
    if animal_repository.get(organization_id, animal_id) is None:
        raise NotFound('Animal no encontrado.')
    assignment = device_repository.active_assignment_for_animal(animal_id)
    if assignment is None:
        raise Conflict('El animal no tiene un collar asignado.')
    command = device_repository.queue_command(assignment.device_id, 'alarm_on', user.id)
    return {'command_id': command.id, 'device_id': assignment.device_id, 'status': command.status}
