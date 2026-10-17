from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from api.services import health_service
from api.traffic.http import respond


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    """Liveness check: confirms the server is up and the database answers."""
    return respond(health_service.get_health())
