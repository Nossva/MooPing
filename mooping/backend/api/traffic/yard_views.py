from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import yard_service
from api.traffic.context import organization_id
from api.traffic.serializers import YardSerializer, validated


@api_view(['GET', 'POST'])
def yard_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        data = validated(YardSerializer, request.data)
        return Response(yard_service.create_yard(org_id, data['name'], data['boundary']), status=201)
    return Response(yard_service.list_yards(org_id))


@api_view(['GET', 'PATCH', 'DELETE'])
def yard_detail(request, yard_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        data = validated(YardSerializer, request.data, partial=True)
        return Response(yard_service.update_yard(org_id, yard_id, data.get('name'), data.get('boundary')))
    if request.method == 'DELETE':
        yard_service.delete_yard(org_id, yard_id)
        return Response(status=204)
    return Response(yard_service.get_yard(org_id, yard_id))
