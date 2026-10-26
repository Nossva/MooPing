from django.db import transaction

from api.dto.response.member_response import MemberAccessResponse, MemberResponse
from api.entities import User
from api.repositories import user_repository
from api.services import access_service, auth_service
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


def _access_response(member, record):
    if member.role == auth_service.OWNER:
        return MemberAccessResponse(list(auth_service.SECTIONS), True, [], [])
    return MemberAccessResponse(auth_service.resolve_sections(member.role, record.sections), record.all_yards,
                                record.yard_ids, record.animal_ids)


def _response(organization_id, user_id):
    member = _get(organization_id, user_id)
    return MemberResponse.from_entity(
        member, _access_response(member, user_repository.get_access(organization_id, user_id)))


def list_members(organization_id):
    access = user_repository.list_access(organization_id)
    return [MemberResponse.from_entity(m, _access_response(m, access[m.user_id]))
            for m in user_repository.list_members(organization_id)]


def set_access(organization_id, user_id, request):
    """request: MemberAccessRequest -> MemberResponse"""
    access_service.set_access(organization_id, user_id, request)
    return _response(organization_id, user_id)


@transaction.atomic
def add_member(organization_id, request):
    """request: MemberCreateRequest -> MemberResponse. Reuses the account if
    the email already exists (its password is left unchanged)."""
    _validate_role(request.role)
    user = user_repository.get_by_email(request.email)
    if user is None:
        name, email = request.name.strip(), request.email.strip().lower()
        auth_service.validate_new_password(request.password, User(name=name, email=email))
        user = user_repository.create(name, email, auth_service.hash_password(request.password),
                                      request.phone or None)
    elif user_repository.get_membership(user.id, organization_id) is not None:
        raise Conflict(f'{request.email} ya es parte del establecimiento.')
    user_repository.add_membership(organization_id, user.id, request.role)
    return _response(organization_id, user.id)


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
    return _response(organization_id, user_id)


@transaction.atomic
def reset_password(organization_id, user_id, acting_user, request):
    """request: MemberPasswordRequest. The owner sets a new password for a
    member and closes all their sessions."""
    if user_id == acting_user.id:
        raise InvalidInput('Para tu propia contraseña usá "Mi cuenta" (te pide la actual).')
    member = _get(organization_id, user_id)
    auth_service.validate_new_password(request.new_password, member.user)
    user_repository.set_password(user_id, auth_service.hash_password(request.new_password))
    user_repository.delete_user_tokens(user_id)


@transaction.atomic
def remove_member(organization_id, user_id):
    """Takes the user out of the establecimiento; the account stays."""
    member = _get(organization_id, user_id)
    if _is_active_owner(member) and user_repository.count_owners(organization_id) <= 1:
        raise Conflict(_LAST_OWNER)
    user_repository.remove_membership(organization_id, user_id)
