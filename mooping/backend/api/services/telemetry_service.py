from django.db import transaction

from api.dto.response.telemetry_response import TelemetryAcceptedResponse
from api.entities import collar_uid
from api.repositories import animal_repository, device_repository, gateway_repository, telemetry_repository
from api.services import alert_service

# Readings further apart than this are not used to derive speed/heading.
_MAX_MOTION_GAP_S = 3600


@transaction.atomic
def ingest(request):
    """request: TelemetryReadingRequest -> TelemetryAcceptedResponse.
    Stores one reading and evaluates alerts. Unknown collars are registered
    without an establecimiento until someone pairs them."""
    device_uid = collar_uid(request.device_uid) or request.device_uid  # 'COLLAR-084' -> 'COLLAR-84'
    device = device_repository.get_or_create_by_uid(device_uid, label=device_uid)
    animal = animal_repository.get_by_device(device.id)
    gateway = gateway_repository.get_by_uid(request.gateway_uid) if request.gateway_uid else None

    speed_mps, heading_deg = request.speed_mps, request.heading_deg
    if request.lat is not None and speed_mps is None:
        motion = telemetry_repository.motion_since_last(device.id, request.lng, request.lat, request.recorded_at)
        if motion and 0 < motion.seconds <= _MAX_MOTION_GAP_S:
            speed_mps = motion.distance_m / motion.seconds
            if motion.distance_m >= 1 and heading_deg is None:
                heading_deg = motion.heading_deg

    reading_id = telemetry_repository.insert(
        device.id, animal.id if animal else None, gateway.id if gateway else None,
        request.recorded_at, request.lng, request.lat,
        temp_body_c=request.temp_body_c, activity=request.activity, rumination_min=request.rumination_min,
        speed_mps=speed_mps, heading_deg=heading_deg,
    )

    alerts_created = []
    if animal is not None and device.organization_id is not None:
        alerts_created = alert_service.evaluate_reading(
            animal, device, request.recorded_at, request.lng, request.lat,
            request.temp_body_c,
        )

    return TelemetryAcceptedResponse(
        reading_id=reading_id,
        device_id=device.id,
        animal_id=animal.id if animal else None,
        alerts_created=alerts_created,
    )
