from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import device_service
from api.traffic.context import organization_id
from api.traffic.serializers import (
    AssignSerializer,
    DeviceListQuery,
    DevicePairSerializer,
    DeviceUpdateSerializer,
    MaintenanceSerializer,
    UnassignSerializer,
    validated,
)


@api_view(['GET', 'POST'])
def device_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        data = validated(DevicePairSerializer, request.data)
        return Response(device_service.pair_device(org_id, **data), status=201)
    query = validated(DeviceListQuery, request.query_params)
    return Response(device_service.list_devices(org_id, query.get('search'), query.get('filter')))


@api_view(['GET', 'PATCH'])
def device_detail(request, device_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        data = validated(DeviceUpdateSerializer, request.data, partial=True)
        return Response(device_service.update_device(org_id, device_id, request.user, **data))
    return Response(device_service.get_device(org_id, device_id))


@api_view(['POST'])
def device_assign(request, device_id):
    data = validated(AssignSerializer, request.data)
    return Response(device_service.assign_device(organization_id(request), device_id, data['animal_id']))


@api_view(['POST'])
def device_unassign(request, device_id):
    data = validated(UnassignSerializer, request.data)
    return Response(device_service.unassign_device(organization_id(request), device_id, data.get('storage_location')))


@api_view(['POST'])
def device_ping(request, device_id):
    return Response(device_service.ping_device(organization_id(request), device_id, request.user), status=202)


@api_view(['POST'])
def device_maintenance(request, device_id):
    data = validated(MaintenanceSerializer, request.data)
    return Response(device_service.schedule_maintenance(organization_id(request), device_id, request.user, **data),
                    status=201)
