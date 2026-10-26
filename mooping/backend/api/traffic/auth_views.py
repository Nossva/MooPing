from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from api.dto.request.auth_request import LoginRequest, PasswordChangeRequest
from api.services import auth_service
from api.traffic.http import request_dto, respond
from api.traffic.serializers import LoginSerializer, PasswordChangeSerializer


class LoginRateThrottle(AnonRateThrottle):
    """Brute-force guard: LOGIN_RATE attempts per client IP (settings.REST_FRAMEWORK)."""
    scope = 'login'


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def login(request):
    return respond(auth_service.login(request_dto(LoginSerializer, LoginRequest, request.data)))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    auth_service.logout(request.auth)
    return Response(status=204)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return respond(auth_service.get_profile(request.user))


# Any logged-in user changes their own password (owner or not).
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    body = request_dto(PasswordChangeSerializer, PasswordChangeRequest, request.data)
    auth_service.change_password(request.user, request.auth, body)
    return Response(status=204)
