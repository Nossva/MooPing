from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.dto.request.yard_request import YardCreateRequest, YardUpdateRequest
from api.services import yard_service
from api.traffic.context import organization_id, scope
from api.traffic.http import request_dto, respond
from api.traffic.serializers import YardSerializer


@api_view(['GET', 'POST'])
def yard_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(YardSerializer, YardCreateRequest, request.data)
        return respond(yard_service.create_yard(org_id, body), status=201)
    return respond(yard_service.list_yards(org_id, scope(request)))


@api_view(['GET', 'PATCH', 'DELETE'])
def yard_detail(request, yard_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(YardSerializer, YardUpdateRequest, request.data, partial=True)
        return respond(yard_service.update_yard(org_id, yard_id, body))
    if request.method == 'DELETE':
        yard_service.delete_yard(org_id, yard_id)
        return Response(status=204)
    return respond(yard_service.get_yard(org_id, yard_id, scope(request)))
