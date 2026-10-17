import hmac

from django.conf import settings
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.services import telemetry_service


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def telemetry_ingest(request):
    """Readings from the Pi: one JSON object or a list. If TELEMETRY_API_KEY is
    set, the Pi must send it in the X-Api-Key header."""
    expected = settings.TELEMETRY_API_KEY
    if expected and not hmac.compare_digest(request.headers.get('X-Api-Key', ''), expected):
        return Response({'detail': 'X-Api-Key inválida.'}, status=401)
    results = telemetry_service.ingest_many(request.data, request.headers.get('X-Gateway-Id'))
    status = 201 if all(r['ok'] for r in results) else 207 if any(r['ok'] for r in results) else 400
    return Response(results if isinstance(request.data, list) else results[0], status=status)
