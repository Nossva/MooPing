from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from api.dto.request.support_request import SupportRequestCreateRequest
from api.services import support_service
from api.traffic.context import membership, organization_id, scope
from api.traffic.http import request_dto, respond
from api.traffic.permissions import IsMember
from api.traffic.serializers import SupportRequestSerializer


class SupportRateThrottle(UserRateThrottle):
    """SUPPORT_RATE reclamos per member (settings.REST_FRAMEWORK); reading isn't limited."""
    scope = 'support'

    def allow_request(self, request, view):
        return request.method != 'POST' or super().allow_request(request, view)


# Every member can ask for help: no require_section.
@api_view(['GET'])
def support(request):
    return respond(support_service.support(organization_id(request), scope(request)))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsMember])
@throttle_classes([SupportRateThrottle])
def support_requests(request):
    """GET: the member's own reclamos. POST {category, message}: sends one."""
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(SupportRequestSerializer, SupportRequestCreateRequest, request.data)
        created = support_service.create_request(org_id, request.user, membership(request).role, body,
                                                 request.headers.get('User-Agent'), scope(request))
        return respond(created, status=201)
    return respond(support_service.list_requests(org_id, request.user))
