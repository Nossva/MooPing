from dataclasses import dataclass


@dataclass
class UserResponse:
    id: int
    name: str
    email: str
    phone: str | None
    initials: str

    @classmethod
    def from_entity(cls, user):
        initials = ''.join(part[0] for part in user.name.split()[:2]).upper()
        return cls(user.id, user.name, user.email, user.phone, initials)


@dataclass
class OrganizationResponse:
    id: int
    name: str
    role: str
    sections: list[str]  # menu sections this member can open (all for owners)

    @classmethod
    def from_record(cls, membership):
        return cls(membership.organization_id, membership.organization_name, membership.role,
                   membership.sections)


@dataclass
class ProfileResponse:
    user: UserResponse
    organizations: list[OrganizationResponse]

    @classmethod
    def build(cls, user, memberships):
        return cls(UserResponse.from_entity(user), [OrganizationResponse.from_record(m) for m in memberships])


@dataclass
class LoginResponse:
    """The token itself travels only in the HttpOnly cookie (auth_views.login)."""
    user: UserResponse
    organizations: list[OrganizationResponse]

    @classmethod
    def build(cls, profile):
        return cls(profile.user, profile.organizations)
