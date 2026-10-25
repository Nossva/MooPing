from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from api.entities import ApiToken, Membership, User
from api.repositories.records import MembershipRecord


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
        MembershipRecord(m.organization_id, m.organization.name, m.role)
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


def update_role(organization_id, user_id, role):
    Membership.objects.filter(organization_id=organization_id, user_id=user_id).update(role=role)


def remove_membership(organization_id, user_id):
    Membership.objects.filter(organization_id=organization_id, user_id=user_id).delete()


def count_owners(organization_id):
    return Membership.objects.filter(organization_id=organization_id, role='owner').count()


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
