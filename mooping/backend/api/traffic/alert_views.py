from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from api.dto.request.alert_request import AlertListRequest, AlertUpdateRequest, NoteCreateRequest
from api.services import alert_service
from api.traffic.context import is_owner, organization_id
from api.traffic.http import request_dto, respond
from api.traffic.permissions import IsMember
from api.traffic.serializers import AlertListQuery, AlertUpdateSerializer, NoteSerializer


@api_view(['GET'])
def alert_list(request):
    query = request_dto(AlertListQuery, AlertListRequest, request.query_params)
    return respond(alert_service.list_alerts(organization_id(request), query))


@api_view(['GET'])
def alert_summary(request):
    return respond(alert_service.summary(organization_id(request)))


# Attending alerts is open to every member, not just the owner.
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsMember])
def alert_detail(request, alert_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        body = request_dto(AlertUpdateSerializer, AlertUpdateRequest, request.data)
        return respond(alert_service.update_alert(org_id, alert_id, request.user, body, is_owner(request)))
    return respond(alert_service.get_alert(org_id, alert_id))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsMember])
def alert_notes(request, alert_id):
    org_id = organization_id(request)
    if request.method == 'POST':
        body = request_dto(NoteSerializer, NoteCreateRequest, request.data)
        return respond(alert_service.add_note(org_id, alert_id, request.user, body), status=201)
    return respond(alert_service.list_notes(org_id, alert_id))
