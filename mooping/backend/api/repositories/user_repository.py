from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from api.entities import ApiToken, Membership, User
from api.repositories.db import execute, fetch_all, fetch_one
from api.repositories.records import AccessRecord, MembershipRecord


def get_by_email(email):
    return User.objects.filter(email__iexact=email).first()


def get_by_id(user_id):
    return User.objects.filter(id=user_id).first()


def create(name, email, password_hash, phone=None):
    return User.objects.create(name=name, email=email, password_hash=password_hash, phone=phone)


def delete_by_emails(emails):
    for email in emails:
        User.objects.filter(email__iexact=email).delete()


def list_memberships(user_id):
    """Ordered by organization id."""
    return [
        MembershipRecord(m.organization_id, m.organization.name, m.role, m.active, m.sections)
        for m in Membership.objects.filter(user_id=user_id).select_related('organization').order_by('organization_id')
    ]


def get_membership(user_id, organization_id):
    return Membership.objects.filter(user_id=user_id, organization_id=organization_id).first()


def add_membership(organization_id, user_id, role):
    Membership.objects.get_or_create(organization_id=organization_id, user_id=user_id, defaults={'role': role})


def list_members(organization_id):
    """Memberships with their user, owners first then by name."""
    return list(
        Membership.objects.filter(organization_id=organization_id).select_related('user')
        .order_by('role', 'user__name')  # 'owner' < 'user'
    )


def get_member(organization_id, user_id):
    return Membership.objects.filter(organization_id=organization_id, user_id=user_id).select_related('user').first()


def update_member(organization_id, user_id, **fields):
    """fields: role and/or active."""
    Membership.objects.filter(organization_id=organization_id, user_id=user_id).update(**fields)


def remove_membership(organization_id, user_id):
    Membership.objects.filter(organization_id=organization_id, user_id=user_id).delete()


_ACCESS = """
    SELECT m.user_id, m.sections, m.all_yards,
           ARRAY(SELECT yard_id FROM member_yards my
                  WHERE my.organization_id = m.organization_id AND my.user_id = m.user_id
                  ORDER BY yard_id) AS yard_ids,
           ARRAY(SELECT animal_id FROM member_animals ma
                  WHERE ma.organization_id = m.organization_id AND ma.user_id = m.user_id
                  ORDER BY animal_id) AS animal_ids
    FROM memberships m
    WHERE m.organization_id = %s
"""


def list_access(organization_id):
    """{user_id: AccessRecord} for every member."""
    return {r.user_id: r for r in fetch_all(_ACCESS, [organization_id], AccessRecord)}


def get_access(organization_id, user_id):
    return fetch_one(_ACCESS + ' AND m.user_id = %s', [organization_id, user_id], AccessRecord)


def set_access(organization_id, user_id, sections, all_yards, yard_ids, animal_ids):
    """Replaces the member's permissions. yard_ids/animal_ids must belong to the organization."""
    Membership.objects.filter(organization_id=organization_id, user_id=user_id).update(
        sections=sections, all_yards=all_yards)
    execute('DELETE FROM member_yards WHERE organization_id = %s AND user_id = %s', [organization_id, user_id])
    execute('DELETE FROM member_animals WHERE organization_id = %s AND user_id = %s', [organization_id, user_id])
    if yard_ids:
        execute('INSERT INTO member_yards (organization_id, user_id, yard_id) SELECT %s, %s, unnest(%s::bigint[])',
                [organization_id, user_id, list(yard_ids)])
    if animal_ids:
        execute('INSERT INTO member_animals (organization_id, user_id, animal_id) '
                'SELECT %s, %s, unnest(%s::bigint[])',
                [organization_id, user_id, list(animal_ids)])


def count_owners(organization_id):
    """Owners whose access is not suspended."""
    return Membership.objects.filter(organization_id=organization_id, role='owner', active=True).count()


def _token_cutoff():
    """Tokens created before this are expired."""
    return timezone.now() - timedelta(days=settings.TOKEN_TTL_DAYS)


def create_token(user_id, token_hash):
    ApiToken.objects.filter(created_at__lt=_token_cutoff()).delete()
    ApiToken.objects.create(token_hash=token_hash, user_id=user_id)


def get_user_by_token(token_hash):
    token = ApiToken.objects.select_related('user').filter(token_hash=token_hash).first()
    if token is None:
        return None
    if token.created_at < _token_cutoff():
        token.delete()
        return None
    ApiToken.objects.filter(token_hash=token_hash).update(last_used_at=timezone.now())
    return token.user


def delete_token(token_hash):
    ApiToken.objects.filter(token_hash=token_hash).delete()


def delete_user_tokens(user_id, keep_hash=None):
    """Closes the user's sessions, except `keep_hash` (the one making the request)."""
    ApiToken.objects.filter(user_id=user_id).exclude(token_hash=keep_hash).delete()


def set_password(user_id, password_hash):
    User.objects.filter(id=user_id).update(password_hash=password_hash)
