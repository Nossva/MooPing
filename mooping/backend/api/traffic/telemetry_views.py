import hmac

from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.dto.request.base import DtoValidationError
from api.dto.request.telemetry_request import TelemetryReadingRequest
from api.dto.response.base import to_json
from api.dto.response.telemetry_response import TelemetryRejectedResponse
from api.services import telemetry_service


def ingest_payload(payload, gateway_uid=None):
    """One JSON object or a list from the Pi -> list of accepted/rejected
    response DTOs. Shared by this view and the TCP listener."""
    items = payload if isinstance(payload, list) else [payload]
    results = []
    for item in items:
        try:
            results.append(telemetry_service.ingest(TelemetryReadingRequest.from_payload(item, gateway_uid)))
        except DtoValidationError as error:
            results.append(TelemetryRejectedResponse(str(error)))
    return results


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def telemetry_ingest(request):
    """Readings from the Pi: one JSON object or a list. If TELEMETRY_API_KEY is
    set, the Pi must send it in the X-Api-Key header."""
    expected = settings.TELEMETRY_API_KEY
    if expected and not hmac.compare_digest(request.headers.get('X-Api-Key', ''), expected):
        return Response({'detail': 'X-Api-Key inválida.'}, status=401)
    results = ingest_payload(request.data, request.headers.get('X-Gateway-Id'))
    accepted = [r.ok for r in results]
    status = 201 if all(accepted) else 207 if any(accepted) else 400
    body = to_json(results) if isinstance(request.data, list) else to_json(results[0])
    return Response(body, status=status)
