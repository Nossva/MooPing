from dataclasses import dataclass
from datetime import datetime


@dataclass
class MemberAccessResponse:
    sections: list[str]     # already resolved: every section for owners
    all_yards: bool
    yard_ids: list[int]     # only meaningful when all_yards is false
    animal_ids: list[int]


@dataclass
class MemberResponse:
    user_id: int
    name: str
    email: str
    phone: str | None
    role: str
    active: bool
    access: MemberAccessResponse
    created_at: datetime

    @classmethod
    def from_entity(cls, membership, access):
        user = membership.user
        return cls(user.id, user.name, user.email, user.phone, membership.role, membership.active, access,
                   membership.created_at)


@dataclass
class OrganizationSettingsResponse:
    id: int
    name: str
    vet_phone: str | None
    fever_threshold_c: float
    no_signal_minutes: int

    @classmethod
    def from_entity(cls, org):
        return cls(org.id, org.name, org.vet_phone, org.fever_threshold_c, org.no_signal_minutes)
