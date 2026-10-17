from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.services import gateway_service, notification_service, product_service
from api.traffic.context import organization_id
from api.traffic.serializers import NotificationSettingsSerializer, validated


@api_view(['GET'])
def gateway_list(request):
    return Response(gateway_service.list_gateways(organization_id(request)))


@api_view(['GET', 'PUT', 'PATCH'])
def notification_settings(request):
    org_id = organization_id(request)
    if request.method in ('PUT', 'PATCH'):
        data = validated(NotificationSettingsSerializer, request.data)
        return Response(notification_service.update_settings(org_id, request.user, **data))
    return Response(notification_service.get_settings(org_id, request.user))


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def product_list(request):
    return Response(product_service.list_products())
