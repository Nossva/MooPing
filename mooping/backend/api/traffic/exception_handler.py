from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from api.services.errors import ServiceError


def exception_handler(exc, context):
    """Service errors -> {"detail": message} with their HTTP status."""
    if isinstance(exc, ServiceError):
        return Response({'detail': exc.message}, status=exc.status_code)
    return drf_exception_handler(exc, context)
