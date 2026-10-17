from django.utils import timezone

from api.entities import ApiToken, Membership, User


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
    """[{organization_id, organization_name, role}] ordered by organization id."""
    return [
        {'organization_id': m.organization_id, 'organization_name': m.organization.name, 'role': m.role}
        for m in Membership.objects.filter(user_id=user_id).select_related('organization').order_by('organization_id')
    ]


def get_membership(user_id, organization_id):
    return Membership.objects.filter(user_id=user_id, organization_id=organization_id).first()


def add_membership(organization_id, user_id, role):
    Membership.objects.get_or_create(organization_id=organization_id, user_id=user_id, defaults={'role': role})


def list_org_users(organization_id):
    return list(
        User.objects.filter(membership__organization_id=organization_id).order_by('name').values('id', 'name', 'email')
    )


def create_token(user_id, token_hash):
    ApiToken.objects.create(token_hash=token_hash, user_id=user_id)


def get_user_by_token(token_hash):
    token = ApiToken.objects.select_related('user').filter(token_hash=token_hash).first()
    if token is None:
        return None
    ApiToken.objects.filter(token_hash=token_hash).update(last_used_at=timezone.now())
    return token.user


def delete_token(token_hash):
    ApiToken.objects.filter(token_hash=token_hash).delete()
