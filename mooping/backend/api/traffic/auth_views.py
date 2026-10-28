from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

from api.dto.request.auth_request import LoginRequest, PasswordChangeRequest
from api.services import auth_service
from api.traffic.authentication import clear_session_cookie, set_session_cookie
from api.traffic.http import request_dto, respond
from api.traffic.serializers import LoginSerializer, PasswordChangeSerializer


class LoginRateThrottle(AnonRateThrottle):
    """Brute-force guard: LOGIN_RATE attempts per client IP (settings.REST_FRAMEWORK)."""
    scope = 'login'


class LoginAccountThrottle(SimpleRateThrottle):
    """LOGIN_ACCOUNT_RATE attempts per email, from any IP: stops a password
    being guessed slowly from many addresses."""
    scope = 'login_account'

    def get_cache_key(self, request, view):
        email = str(request.data.get('email', '')).strip().lower() if hasattr(request.data, 'get') else ''
        return self.cache_format % {'scope': self.scope, 'ident': email} if email else None


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle, LoginAccountThrottle])
def login(request):
    token, profile = auth_service.login(request_dto(LoginSerializer, LoginRequest, request.data))
    response = respond(profile)
    set_session_cookie(response, token)
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    auth_service.logout(request.auth)
    response = Response(status=204)
    clear_session_cookie(response)
    return response


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
