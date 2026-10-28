from django.http import FileResponse, Http404
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny

from api.dto.request.animal_request import (
    AnimalCreateRequest,
    AnimalListRequest,
    AnimalPositionsRequest,
    AnimalUpdateRequest,
    TrackRequest,
)
from api.repositories import photo_repository
from api.services import animal_service
from api.traffic.context import organization_id, require_section, scope
from api.traffic.http import request_dto, respond
from api.traffic.serializers import AnimalListQuery, AnimalSerializer, PositionsQuery, TrackQuery


@api_view(['GET', 'POST'])
def animal_list(request):
    require_section(request, 'monitoreo')
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(AnimalSerializer, AnimalCreateRequest, request.data)
        return respond(animal_service.create_animal(org_id, body), status=201)
    query = request_dto(AnimalListQuery, AnimalListRequest, request.query_params)
    return respond(animal_service.list_animals(org_id, query, scope(request)))


@api_view(['GET'])
def animal_positions(request):
    require_section(request, 'monitoreo')
    query = request_dto(PositionsQuery, AnimalPositionsRequest, request.query_params)
    return respond(animal_service.list_positions(organization_id(request), query, scope(request)))


@api_view(['GET', 'PATCH'])
def animal_detail(request, animal_id):
    require_section(request, 'monitoreo')
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(AnimalSerializer, AnimalUpdateRequest, request.data, partial=True)
        return respond(animal_service.update_animal(org_id, animal_id, body))
    return respond(animal_service.get_animal(org_id, animal_id, scope(request)))


@api_view(['GET'])
def animal_track(request, animal_id):
    require_section(request, 'monitoreo')
    query = request_dto(TrackQuery, TrackRequest, request.query_params)
    return respond(animal_service.get_track(organization_id(request), animal_id, query, scope(request)))


@api_view(['POST', 'DELETE'])
@parser_classes([MultiPartParser])
def animal_photo(request, animal_id):
    """POST multipart con el archivo en "photo" (reemplaza la anterior); DELETE la quita."""
    require_section(request, 'monitoreo')
    org_id = organization_id(request)
    if request.method == 'DELETE':
        return respond(animal_service.remove_photo(org_id, animal_id))
    return respond(animal_service.set_photo(org_id, animal_id, request.FILES.get('photo')))


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def animal_photo_file(request, name):
    """Public: <img> can't send the token. The name is random (photo_repository)."""
    file = photo_repository.path(name)
    if file is None:
        raise Http404
    response = FileResponse(file.open('rb'), content_type=photo_repository.CONTENT_TYPES[file.suffix[1:]])
    response['Cache-Control'] = 'public, max-age=31536000, immutable'  # a new photo gets a new name
    return response


@api_view(['POST'])
def animal_alarm(request, animal_id):
    return respond(animal_service.trigger_alarm(organization_id(request), animal_id, request.user), status=202)
