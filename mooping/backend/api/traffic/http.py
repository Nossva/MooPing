"""Glue between DRF and the DTO layer."""
from rest_framework.response import Response

from api.dto.response.base import to_json


def request_dto(serializer_class, dto_class, data, partial=False):
    """Validates `data` with the serializer and builds the request DTO."""
    serializer = serializer_class(data=data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return dto_class(**serializer.validated_data)


def respond(dto, status=200):
    """Response DTO (or list of them) -> HTTP response."""
    return Response(to_json(dto), status=status)
