from dataclasses import asdict

from django.db import IntegrityError, transaction

from api.dto.response.animal_response import (
    AnimalDetailResponse,
    AnimalPositionResponse,
    AnimalResponse,
    TrackPointResponse,
    TrackResponse,
)
from api.dto.response.command_response import CommandQueuedResponse
from api.repositories import (
    alert_repository,
    animal_repository,
    device_repository,
    organization_repository,
    photo_repository,
    yard_repository,
)
from api.services.errors import Conflict, InvalidInput, NotFound

NORMAL_TEMP_MIN_C = 38.0
PHOTO_MAX_BYTES = 5 * 1024 * 1024


def _check_yard(organization_id, yard_id):
    if yard_id is not None and yard_repository.get(organization_id, yard_id) is None:
        raise InvalidInput('El potrero no existe en este establecimiento.')


def _check_geofence(geofence):
    if geofence not in (None, 'inside', 'outside'):
        raise InvalidInput("geofence debe ser 'inside' u 'outside'.")


def list_animals(organization_id, request, scope=None):
    """request: AnimalListRequest -> list[AnimalResponse]"""
    _check_geofence(request.geofence)
    records = animal_repository.list_rows(organization_id, search=request.search, yard_id=request.yard_id,
                                          geofence=request.geofence, status=request.status, scope=scope,
                                          **({'limit': request.limit} if request.limit else {}))
    return [AnimalResponse.from_record(r) for r in records]


def list_positions(organization_id, request, scope=None):
    """request: AnimalPositionsRequest -> list[AnimalPositionResponse] (map markers)"""
    _check_geofence(request.geofence)
    records = animal_repository.list_rows(organization_id, yard_id=request.yard_id, geofence=request.geofence,
                                          scope=scope)
    return [AnimalPositionResponse.from_record(r) for r in records if r.lat is not None]


def get_animal(organization_id, animal_id, scope=None):
    """Ficha shown in Monitoreo: vitals, activity, position, collar, open alerts."""
    record = animal_repository.get_row(organization_id, animal_id, scope)
    if record is None:
        raise NotFound('Animal no encontrado.')
    org = organization_repository.get(organization_id)
    return AnimalDetailResponse.build(
        record,
        alert_records=alert_repository.list_rows(organization_id, status='open', animal_id=animal_id),
        temp_min=NORMAL_TEMP_MIN_C,
        temp_max=org.fever_threshold_c,
        distance_today_m=animal_repository.distance_today_m(animal_id),
        rumination_4h_min=animal_repository.rumination_minutes(animal_id, 4),
    )


def create_animal(organization_id, request):
    """request: AnimalCreateRequest -> AnimalDetailResponse"""
    if not request.name:
        raise InvalidInput('El nombre es obligatorio.')
    _check_yard(organization_id, request.yard_id)
    try:
        with transaction.atomic():
            animal = animal_repository.create(organization_id, **asdict(request))
    except IntegrityError:
        raise Conflict('Ya existe un animal con esa caravana.')
    return get_animal(organization_id, animal.id)


def update_animal(organization_id, animal_id, request):
    """request: AnimalUpdateRequest (only the sent fields change)."""
    animal = animal_repository.get(organization_id, animal_id)
    if animal is None:
        raise NotFound('Animal no encontrado.')
    changes = request.changes()
    if 'yard_id' in changes:
        _check_yard(organization_id, changes['yard_id'])
    old_photo = animal.photo_url
    try:
        with transaction.atomic():
            animal_repository.update(animal, **changes)
    except IntegrityError:
        raise Conflict('Ya existe un animal con esa caravana.')
    if changes.get('photo_url', old_photo) != old_photo:
        photo_repository.delete_url(old_photo)
    return get_animal(organization_id, animal_id)


def _image_extension(head):
    """Real type from the first bytes (the browser's content type can't be trusted)."""
    if head.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    if head[:6] in (b'GIF87a', b'GIF89a'):
        return 'gif'
    return None


def set_photo(organization_id, animal_id, upload):
    """upload: the uploaded file (Django UploadedFile) -> AnimalDetailResponse"""
    animal = animal_repository.get(organization_id, animal_id)
    if animal is None:
        raise NotFound('Animal no encontrado.')
    if upload is None:
        raise InvalidInput('Falta la foto (campo "photo").')
    if upload.size > PHOTO_MAX_BYTES:
        raise InvalidInput(f'La foto pesa más de {PHOTO_MAX_BYTES // (1024 * 1024)} MB.')
    content = upload.read()
    extension = _image_extension(content[:12])
    if extension is None:
        raise InvalidInput('La foto tiene que ser JPG, PNG, WEBP o GIF.')
    old_photo = animal.photo_url
    animal_repository.update(animal, photo_url=photo_repository.save(content, extension))
    photo_repository.delete_url(old_photo)
    return get_animal(organization_id, animal_id)


def remove_photo(organization_id, animal_id):
    animal = animal_repository.get(organization_id, animal_id)
    if animal is None:
        raise NotFound('Animal no encontrado.')
    old_photo = animal.photo_url
    animal_repository.update(animal, photo_url=None)
    photo_repository.delete_url(old_photo)
    return get_animal(organization_id, animal_id)


def get_track(organization_id, animal_id, request, scope=None):
    """request: TrackRequest -> TrackResponse"""
    if animal_repository.get(organization_id, animal_id, scope) is None:
        raise NotFound('Animal no encontrado.')
    if not 1 <= request.hours <= 24 * 30:
        raise InvalidInput('hours debe estar entre 1 y 720.')
    points = animal_repository.track(organization_id, animal_id, request.hours)
    return TrackResponse(animal_id, request.hours, [TrackPointResponse.from_record(p) for p in points])


def trigger_alarm(organization_id, animal_id, user):
    """'Alarma sonora': queues a command for the animal's collar."""
    if animal_repository.get(organization_id, animal_id) is None:
        raise NotFound('Animal no encontrado.')
    assignment = device_repository.active_assignment_for_animal(animal_id)
    if assignment is None:
        raise Conflict('El animal no tiene un collar asignado.')
    return CommandQueuedResponse.from_entity(
        device_repository.queue_command(assignment.device_id, 'alarm_on', user.id)
    )
