import hashlib
import secrets

from django.contrib.auth.hashers import check_password, make_password

from api.dto.response.auth_response import LoginResponse, ProfileResponse
from api.repositories import user_repository
from api.services.errors import Forbidden, InvalidInput, Unauthorized

# memberships.role (see schema.sql)
OWNER = 'owner'
USER = 'user'
ROLES = (OWNER, USER)


def _hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password):
    return make_password(password)


def login(request):
    """request: LoginRequest -> LoginResponse"""
    user = user_repository.get_by_email(request.email)
    if user is None or not check_password(request.password, user.password_hash):
        raise Unauthorized('Email o contraseña incorrectos.')
    token = secrets.token_urlsafe(32)
    user_repository.create_token(user.id, _hash_token(token))
    return LoginResponse.build(token, get_profile(user))


def logout(token):
    user_repository.delete_token(_hash_token(token))


def user_for_token(token):
    """User entity owning the token, or None."""
    return user_repository.get_user_by_token(_hash_token(token))


def resolve_membership(user, requested_id=None):
    """MembershipRecord the request acts on: the requested organization if the
    user belongs to it, else the user's first one."""
    memberships = user_repository.list_memberships(user.id)
    if not memberships:
        raise Forbidden('El usuario no pertenece a ningún establecimiento.')
    if requested_id is None:
        return memberships[0]
    try:
        requested_id = int(requested_id)
    except (TypeError, ValueError):
        raise InvalidInput('X-Organization-Id inválido.')
    for membership in memberships:
        if membership.organization_id == requested_id:
            return membership
    raise Forbidden('No tenés acceso a ese establecimiento.')


def resolve_organization(user, requested_id=None):
    return resolve_membership(user, requested_id).organization_id


def get_profile(user):
    return ProfileResponse.build(user, user_repository.list_memberships(user.id))
