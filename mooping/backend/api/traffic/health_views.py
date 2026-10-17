from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import health_service


@api_view(['GET'])
def health(request):
    """Liveness check: confirms the server is up and the database answers."""
    return Response(health_service.get_health())
