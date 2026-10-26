from math import ceil

from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from api.dto.request.base import DtoValidationError
from api.services.errors import ServiceError


def exception_handler(exc, context):
    """Service errors -> {"detail": message} with their HTTP status; input
    that cannot become a request DTO -> 400."""
    if isinstance(exc, ServiceError):
        return Response({'detail': exc.message}, status=exc.status_code)
    if isinstance(exc, DtoValidationError):
        return Response({'detail': str(exc)}, status=400)
    if isinstance(exc, Throttled):
        wait = f' en {ceil(exc.wait)} s' if exc.wait else ' en un rato'
        return Response({'detail': f'Demasiados intentos. Probá de nuevo{wait}.'}, status=429,
                        headers={'Retry-After': str(ceil(exc.wait))} if exc.wait else None)
    return drf_exception_handler(exc, context)
