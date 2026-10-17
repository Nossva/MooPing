from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny

from api.dto.request.notification_request import NotificationSettingsUpdateRequest
from api.services import gateway_service, notification_service, product_service
from api.traffic.context import organization_id
from api.traffic.http import request_dto, respond
from api.traffic.serializers import NotificationSettingsSerializer


@api_view(['GET'])
def gateway_list(request):
    return respond(gateway_service.list_gateways(organization_id(request)))


@api_view(['GET', 'PUT', 'PATCH'])
def notification_settings(request):
    org_id = organization_id(request)
    if request.method in ('PUT', 'PATCH'):
        body = request_dto(NotificationSettingsSerializer, NotificationSettingsUpdateRequest, request.data,
                           partial=True)
        return respond(notification_service.update_settings(org_id, request.user, body))
    return respond(notification_service.get_settings(org_id, request.user))


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def product_list(request):
    return respond(product_service.list_products())
