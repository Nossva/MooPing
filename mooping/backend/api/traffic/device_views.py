from rest_framework.decorators import api_view

from api.dto.request.device_request import (
    AssignRequest,
    DeviceListRequest,
    DevicePairRequest,
    DeviceUpdateRequest,
    MaintenanceRequest,
    UnassignRequest,
)
from api.services import device_service
from api.traffic.context import organization_id, require_section, scope
from api.traffic.http import request_dto, respond
from api.traffic.serializers import (
    AssignSerializer,
    DeviceListQuery,
    DevicePairSerializer,
    DeviceUpdateSerializer,
    MaintenanceSerializer,
    UnassignSerializer,
)


@api_view(['GET', 'POST'])
def device_list(request):
    require_section(request, 'equipos')
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(DevicePairSerializer, DevicePairRequest, request.data)
        return respond(device_service.pair_device(org_id, body), status=201)
    query = request_dto(DeviceListQuery, DeviceListRequest, request.query_params)
    return respond(device_service.list_devices(org_id, query, scope(request)))


@api_view(['GET', 'PATCH'])
def device_detail(request, device_id):
    require_section(request, 'equipos')
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(DeviceUpdateSerializer, DeviceUpdateRequest, request.data, partial=True)
        return respond(device_service.update_device(org_id, device_id, request.user, body))
    return respond(device_service.get_device(org_id, device_id, scope(request)))


@api_view(['POST'])
def device_assign(request, device_id):
    body = request_dto(AssignSerializer, AssignRequest, request.data)
    return respond(device_service.assign_device(organization_id(request), device_id, body))


@api_view(['POST'])
def device_unassign(request, device_id):
    body = request_dto(UnassignSerializer, UnassignRequest, request.data)
    return respond(device_service.unassign_device(organization_id(request), device_id, body))


@api_view(['POST'])
def device_ping(request, device_id):
    return respond(device_service.ping_device(organization_id(request), device_id, request.user), status=202)


@api_view(['POST'])
def device_maintenance(request, device_id):
    body = request_dto(MaintenanceSerializer, MaintenanceRequest, request.data)
    return respond(device_service.schedule_maintenance(organization_id(request), device_id, request.user, body),
                   status=201)
