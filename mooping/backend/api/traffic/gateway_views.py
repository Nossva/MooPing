from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.dto.request.gateway_request import GatewayCreateRequest, GatewayUpdateRequest
from api.services import gateway_service
from api.traffic.context import organization_id, require_section, scope
from api.traffic.http import request_dto, respond
from api.traffic.serializers import GatewayCreateSerializer, GatewayUpdateSerializer


@api_view(['GET', 'POST'])
def gateway_list(request):
    require_section(request, 'equipos')
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(GatewayCreateSerializer, GatewayCreateRequest, request.data)
        return respond(gateway_service.create_gateway(org_id, body), status=201)
    return respond(gateway_service.list_gateways(org_id, scope(request)))


@api_view(['GET', 'PATCH', 'DELETE'])
def gateway_detail(request, gateway_id):
    require_section(request, 'equipos')
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(GatewayUpdateSerializer, GatewayUpdateRequest, request.data, partial=True)
        return respond(gateway_service.update_gateway(org_id, gateway_id, body))
    if request.method == 'DELETE':
        gateway_service.delete_gateway(org_id, gateway_id)
        return Response(status=204)
    return respond(gateway_service.get_gateway(org_id, gateway_id, scope(request)))


@api_view(['GET'])
def gateway_devices(request, gateway_id):
    """Collars heard through this gateway lately (the collar is not tied to it)."""
    require_section(request, 'equipos')
    return respond(gateway_service.list_heard_devices(organization_id(request), gateway_id, scope(request)))
