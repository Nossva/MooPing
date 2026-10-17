from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import animal_service
from api.traffic.context import organization_id
from api.traffic.serializers import AnimalListQuery, AnimalSerializer, TrackQuery, YardQuery, validated


@api_view(['GET', 'POST'])
def animal_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        data = validated(AnimalSerializer, request.data)
        return Response(animal_service.create_animal(org_id, **data), status=201)
    query = validated(AnimalListQuery, request.query_params)
    return Response(animal_service.list_animals(org_id, **query))


@api_view(['GET'])
def animal_positions(request):
    query = validated(YardQuery, request.query_params)
    geofence = request.query_params.get('geofence')
    return Response(animal_service.list_positions(organization_id(request), query.get('yard_id'), geofence))


@api_view(['GET', 'PATCH'])
def animal_detail(request, animal_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        data = validated(AnimalSerializer, request.data, partial=True)
        return Response(animal_service.update_animal(org_id, animal_id, **data))
    return Response(animal_service.get_animal(org_id, animal_id))


@api_view(['GET'])
def animal_track(request, animal_id):
    query = validated(TrackQuery, request.query_params)
    return Response(animal_service.get_track(organization_id(request), animal_id, query['hours']))


@api_view(['POST'])
def animal_alarm(request, animal_id):
    return Response(animal_service.trigger_alarm(organization_id(request), animal_id, request.user), status=202)
