"""What each member can see: sections of the app and potreros / animals.

Owners always see everything. A "user" sees the sections in
memberships.sections (None = all) and, if all_yards is false, only the animals
in member_yards plus the loose member_animals (with their collars and alerts).
"""
from dataclasses import dataclass

from django.db import transaction

from api.repositories import animal_repository, user_repository, yard_repository
from api.repositories.scope import Scope
from api.services import auth_service
from api.services.auth_service import SECTIONS, resolve_sections
from api.services.errors import Forbidden, InvalidInput, NotFound


@dataclass(frozen=True)
class Access:
    sections: tuple[str, ...]
    scope: Scope | None  # None = every potrero and animal

    def can(self, section):
        return section in self.sections


FULL = Access(SECTIONS, None)


def for_member(organization_id, user_id, role):
    """Access of the request's member (see traffic/context.access)."""
    if role == auth_service.OWNER:
        return FULL
    record = user_repository.get_access(organization_id, user_id)
    scope = None if record.all_yards else Scope(tuple(record.yard_ids), tuple(record.animal_ids))
    return Access(tuple(resolve_sections(role, record.sections)), scope)


def require(access, section):
    if not access.can(section):
        raise Forbidden('No tenés acceso a esta sección.')


@transaction.atomic
def set_access(organization_id, user_id, request):
    """request: MemberAccessRequest. Only for members with role "user"."""
    member = user_repository.get_member(organization_id, user_id)
    if member is None:
        raise NotFound('Usuario no encontrado en el establecimiento.')
    if member.role == auth_service.OWNER:
        raise InvalidInput('Los dueños ven todo: para limitarlo, pasalo a Usuario.')

    unknown = set(request.sections) - set(SECTIONS)
    if unknown:
        raise InvalidInput(f'Sección inválida: {", ".join(sorted(unknown))}.')
    if not request.sections:
        raise InvalidInput('Elegí al menos una sección.')
    yard_ids = set(request.yard_ids)
    if yard_ids - yard_repository.existing_ids(organization_id, yard_ids):
        raise InvalidInput('Algún potrero no es de este establecimiento.')
    animal_ids = set(request.animal_ids)
    if animal_ids - animal_repository.existing_ids(organization_id, animal_ids):
        raise InvalidInput('Algún animal no es de este establecimiento.')

    # Every section checked = None, so sections added later are included too.
    sections = None if set(request.sections) == set(SECTIONS) else [s for s in SECTIONS if s in request.sections]
    # With all_yards the lists don't apply: don't keep stale picks around.
    if request.all_yards:
        yard_ids, animal_ids = set(), set()
    user_repository.set_access(organization_id, user_id, sections, request.all_yards,
                               sorted(yard_ids), sorted(animal_ids))
