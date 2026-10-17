from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.services import health_service


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness check: confirms the server is up and the database answers."""
    return Response(health_service.get_health())
