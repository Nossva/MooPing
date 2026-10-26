from dataclasses import dataclass

from api.dto.request.base import UNSET, PatchRequest


@dataclass
class MemberCreateRequest:
    name: str
    email: str
    password: str
    role: str = 'user'
    phone: str | None = None


@dataclass
class MemberUpdateRequest(PatchRequest):
    role: str = UNSET
    active: bool = UNSET  # false = acceso suspendido


@dataclass
class MemberPasswordRequest:
    new_password: str


@dataclass
class OrganizationUpdateRequest(PatchRequest):
    name: str = UNSET
    vet_phone: str | None = UNSET
    fever_threshold_c: float = UNSET
    low_battery_pct: float = UNSET
    no_signal_minutes: int = UNSET
