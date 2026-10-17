from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from api.services import auth_service


def bearer_token(request):
    parts = get_authorization_header(request).split()
    if len(parts) != 2 or parts[0].lower() != b'bearer':
        return None
    return parts[1].decode()


class BearerTokenAuthentication(BaseAuthentication):
    """Authorization: Bearer <token> (token from POST /api/auth/login)."""

    def authenticate(self, request):
        token = bearer_token(request)
        if token is None:
            return None
        user = auth_service.user_for_token(token)
        if user is None:
            raise AuthenticationFailed('Token inválido o vencido.')
        return user, token

    def authenticate_header(self, request):
        return 'Bearer'
