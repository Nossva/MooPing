from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.services import auth_service
from api.traffic.serializers import LoginSerializer, validated


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login(request):
    data = validated(LoginSerializer, request.data)
    return Response(auth_service.login(data['email'], data['password']))


@api_view(['POST'])
def logout(request):
    auth_service.logout(request.auth)
    return Response(status=204)


@api_view(['GET'])
def me(request):
    return Response(auth_service.get_profile(request.user))
