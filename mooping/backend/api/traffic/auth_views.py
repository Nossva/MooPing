from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.dto.request.auth_request import LoginRequest
from api.services import auth_service
from api.traffic.http import request_dto, respond
from api.traffic.serializers import LoginSerializer


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    return respond(auth_service.login(request_dto(LoginSerializer, LoginRequest, request.data)))


@api_view(['POST'])
def logout(request):
    auth_service.logout(request.auth)
    return Response(status=204)


@api_view(['GET'])
def me(request):
    return respond(auth_service.get_profile(request.user))
