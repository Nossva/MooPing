from rest_framework.decorators import api_view
from rest_framework.response import Response

from api.services import dashboard_service, infrastructure_service, monitoring_service, status_service
from api.traffic.context import organization_id
from api.traffic.serializers import YardQuery, validated


@api_view(['GET'])
def status(request):
    return Response(status_service.status(organization_id(request)))


@api_view(['GET'])
def dashboard_summary(request):
    return Response(dashboard_service.summary(organization_id(request)))


@api_view(['GET'])
def monitoring_summary(request):
    query = validated(YardQuery, request.query_params)
    return Response(monitoring_service.summary(organization_id(request), query.get('yard_id')))


@api_view(['GET'])
def infrastructure_summary(request):
    return Response(infrastructure_service.summary(organization_id(request)))
