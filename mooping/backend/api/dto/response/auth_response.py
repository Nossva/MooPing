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

    @classmethod
    def from_record(cls, membership):
        return cls(membership.organization_id, membership.organization_name, membership.role)


@dataclass
class ProfileResponse:
    user: UserResponse
    organizations: list[OrganizationResponse]

    @classmethod
    def build(cls, user, memberships):
        return cls(UserResponse.from_entity(user), [OrganizationResponse.from_record(m) for m in memberships])


@dataclass
class LoginResponse:
    token: str
    user: UserResponse
    organizations: list[OrganizationResponse]

    @classmethod
    def build(cls, token, profile):
        return cls(token, profile.user, profile.organizations)
