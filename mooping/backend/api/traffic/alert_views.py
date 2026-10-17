from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import alert_service
from api.traffic.context import organization_id
from api.traffic.serializers import AlertListQuery, AlertUpdateSerializer, NoteSerializer, validated


@api_view(['GET'])
def alert_list(request):
    query = validated(AlertListQuery, request.query_params)
    return Response(alert_service.list_alerts(organization_id(request), **query))


@api_view(['GET'])
def alert_summary(request):
    return Response(alert_service.summary(organization_id(request)))


@api_view(['GET', 'PATCH'])
def alert_detail(request, alert_id):
    org_id = organization_id(request)
    if request.method == 'PATCH':
        data = validated(AlertUpdateSerializer, request.data)
        return Response(alert_service.update_alert(org_id, alert_id, request.user, **data))
    return Response(alert_service.get_alert(org_id, alert_id))


@api_view(['GET', 'POST'])
def alert_notes(request, alert_id):
    org_id = organization_id(request)
    if request.method == 'POST':
        data = validated(NoteSerializer, request.data)
        return Response(alert_service.add_note(org_id, alert_id, request.user, data['body']), status=201)
    return Response(alert_service.list_notes(org_id, alert_id))
