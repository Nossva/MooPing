from rest_framework.decorators import api_view

from api.dto.request.animal_request import (
    AnimalCreateRequest,
    AnimalListRequest,
    AnimalPositionsRequest,
    AnimalUpdateRequest,
    TrackRequest,
)
from api.services import animal_service
from api.traffic.context import organization_id
from api.traffic.http import request_dto, respond
from api.traffic.serializers import AnimalListQuery, AnimalSerializer, PositionsQuery, TrackQuery


@api_view(['GET', 'POST'])
def animal_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(AnimalSerializer, AnimalCreateRequest, request.data)
        return respond(animal_service.create_animal(org_id, body), status=201)
    query = request_dto(AnimalListQuery, AnimalListRequest, request.query_params)
    return respond(animal_service.list_animals(org_id, query))


@api_view(['GET'])
def animal_positions(request):
    query = request_dto(PositionsQuery, AnimalPositionsRequest, request.query_params)
    return respond(animal_service.list_positions(organization_id(request), query))


@api_view(['GET', 'PATCH'])
def animal_detail(request, animal_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(AnimalSerializer, AnimalUpdateRequest, request.data, partial=True)
        return respond(animal_service.update_animal(org_id, animal_id, body))
    return respond(animal_service.get_animal(org_id, animal_id))


@api_view(['GET'])
def animal_track(request, animal_id):
    query = request_dto(TrackQuery, TrackRequest, request.query_params)
    return respond(animal_service.get_track(organization_id(request), animal_id, query))


@api_view(['POST'])
def animal_alarm(request, animal_id):
    return respond(animal_service.trigger_alarm(organization_id(request), animal_id, request.user), status=202)
