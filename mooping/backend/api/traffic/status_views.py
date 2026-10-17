from rest_framework.decorators import api_view

from api.dto.request.summary_request import YardQueryRequest
from api.services import dashboard_service, infrastructure_service, monitoring_service, status_service
from api.traffic.context import organization_id
from api.traffic.http import request_dto, respond
from api.traffic.serializers import YardQuery


@api_view(['GET'])
def status(request):
    return respond(status_service.status(organization_id(request)))


@api_view(['GET'])
def dashboard_summary(request):
    return respond(dashboard_service.summary(organization_id(request)))


@api_view(['GET'])
def monitoring_summary(request):
    query = request_dto(YardQuery, YardQueryRequest, request.query_params)
    return respond(monitoring_service.summary(organization_id(request), query))


@api_view(['GET'])
def infrastructure_summary(request):
    return respond(infrastructure_service.summary(organization_id(request)))
