from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.dto.request.member_request import (
    MemberCreateRequest,
    MemberPasswordRequest,
    MemberUpdateRequest,
    OrganizationUpdateRequest,
)
from api.services import member_service, organization_service
from api.traffic.context import organization_id
from api.traffic.http import request_dto, respond
from api.traffic.serializers import (
    MemberCreateSerializer,
    MemberPasswordSerializer,
    MemberUpdateSerializer,
    OrganizationUpdateSerializer,
)

# Panel "Administración". Members can read; writes are owner-only through the
# default IsOwnerOrReadOnly permission.


@api_view(['GET', 'PATCH'])
def organization_detail(request):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(OrganizationUpdateSerializer, OrganizationUpdateRequest, request.data, partial=True)
        return respond(organization_service.update_settings(org_id, body))
    return respond(organization_service.get_settings(org_id))


@api_view(['GET', 'POST'])
def member_list(request):
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(MemberCreateSerializer, MemberCreateRequest, request.data)
        return respond(member_service.add_member(org_id, body), status=201)
    return respond(member_service.list_members(org_id))


@api_view(['PATCH', 'DELETE'])
def member_detail(request, user_id):
    org_id = organization_id(request)
    if request.method == 'DELETE':
        member_service.remove_member(org_id, user_id)
        return Response(status=204)
    body = request_dto(MemberUpdateSerializer, MemberUpdateRequest, request.data, partial=True)
    return respond(member_service.update_member(org_id, user_id, request.user, body))


@api_view(['POST'])
def member_password(request, user_id):
    body = request_dto(MemberPasswordSerializer, MemberPasswordRequest, request.data)
    member_service.reset_password(organization_id(request), user_id, request.user, body)
    return Response(status=204)
