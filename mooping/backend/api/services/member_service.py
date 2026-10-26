from django.db import transaction

from api.dto.response.member_response import MemberResponse
from api.repositories import user_repository
from api.services import auth_service
from api.services.errors import Conflict, InvalidInput, NotFound

_LAST_OWNER = 'El establecimiento necesita al menos un dueño.'


def _validate_role(role):
    if role not in auth_service.ROLES:
        raise InvalidInput(f'role inválido: {role}')


def _get(organization_id, user_id):
    member = user_repository.get_member(organization_id, user_id)
    if member is None:
        raise NotFound('Usuario no encontrado en el establecimiento.')
    return member


def list_members(organization_id):
    return [MemberResponse.from_entity(m) for m in user_repository.list_members(organization_id)]


@transaction.atomic
def add_member(organization_id, request):
    """request: MemberCreateRequest -> MemberResponse. Reuses the account if
    the email already exists (its password is left unchanged)."""
    _validate_role(request.role)
    user = user_repository.get_by_email(request.email)
    if user is None:
        if len(request.password) < 8:
            raise InvalidInput('La contraseña necesita al menos 8 caracteres.')
        user = user_repository.create(request.name.strip(), request.email.strip().lower(),
                                      auth_service.hash_password(request.password), request.phone or None)
    elif user_repository.get_membership(user.id, organization_id) is not None:
        raise Conflict(f'{request.email} ya es parte del establecimiento.')
    user_repository.add_membership(organization_id, user.id, request.role)
    return MemberResponse.from_entity(_get(organization_id, user.id))


def _is_active_owner(member):
    return member.role == auth_service.OWNER and member.active


@transaction.atomic
def update_member(organization_id, user_id, acting_user, request):
    """request: MemberUpdateRequest (role and/or active) -> MemberResponse.
    active=false suspends the user's access without removing them."""
    changes = request.changes()
    if 'role' in changes:
        _validate_role(changes['role'])
    member = _get(organization_id, user_id)
    if changes.get('active') is False and user_id == acting_user.id:
        raise Conflict('No podés suspender tu propio acceso.')
    stops_being_owner = changes.get('role', member.role) != auth_service.OWNER or changes.get('active') is False
    if (_is_active_owner(member) and stops_being_owner
            and user_repository.count_owners(organization_id) <= 1):
        raise Conflict(_LAST_OWNER)
    if changes:
        user_repository.update_member(organization_id, user_id, **changes)
    return MemberResponse.from_entity(_get(organization_id, user_id))


@transaction.atomic
def remove_member(organization_id, user_id):
    """Takes the user out of the establecimiento; the account stays."""
    member = _get(organization_id, user_id)
    if _is_active_owner(member) and user_repository.count_owners(organization_id) <= 1:
        raise Conflict(_LAST_OWNER)
    user_repository.remove_membership(organization_id, user_id)
