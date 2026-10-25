from dataclasses import dataclass
from datetime import datetime


@dataclass
class MemberResponse:
    user_id: int
    name: str
    email: str
    phone: str | None
    role: str
    created_at: datetime

    @classmethod
    def from_entity(cls, membership):
        user = membership.user
        return cls(user.id, user.name, user.email, user.phone, membership.role, membership.created_at)


@dataclass
class OrganizationSettingsResponse:
    id: int
    name: str
    vet_phone: str | None
    fever_threshold_c: float
    low_battery_pct: float
    no_signal_minutes: int

    @classmethod
    def from_entity(cls, org):
        return cls(org.id, org.name, org.vet_phone, org.fever_threshold_c, org.low_battery_pct,
                   org.no_signal_minutes)
