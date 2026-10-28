from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from api.services import auth_service

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS')
# The web app sends it on every request. Another site can't add a custom header
# without a CORS preflight (which CORS_ALLOWED_ORIGINS refuses), so it blocks CSRF.
CSRF_HEADER = 'X-Requested-With'


class SessionCookieAuthentication(BaseAuthentication):
    """Session token from POST /api/auth/login, in an HttpOnly cookie: JS can't
    read it, so an XSS can't steal the session."""

    def authenticate(self, request):
        token = request.COOKIES.get(settings.AUTH_COOKIE_NAME)
        if not token:
            return None
        user = auth_service.user_for_token(token)
        if user is None:
            raise AuthenticationFailed('Sesión vencida. Volvé a entrar.')
        if request.method not in SAFE_METHODS and not request.headers.get(CSRF_HEADER):
            raise PermissionDenied(f'Falta el header {CSRF_HEADER}.')
        return user, token

    def authenticate_header(self, request):
        # Makes DRF answer 401 (not 403) when the cookie is missing.
        return 'Cookie'


def set_session_cookie(response, token):
    response.set_cookie(
        settings.AUTH_COOKIE_NAME, token,
        max_age=settings.TOKEN_TTL_DAYS * 24 * 3600,
        path='/api/',
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite='Lax',
    )


def clear_session_cookie(response):
    response.delete_cookie(settings.AUTH_COOKIE_NAME, path='/api/', samesite='Lax')
