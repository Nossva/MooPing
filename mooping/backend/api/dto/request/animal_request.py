from dataclasses import dataclass
from datetime import date

from api.dto.request.base import UNSET, PatchRequest


@dataclass
class AnimalListRequest:
    search: str | None = None
    yard_id: int | None = None
    geofence: str | None = None        # inside | outside
    status: str = 'active'


@dataclass
class AnimalPositionsRequest:
    yard_id: int | None = None
    geofence: str | None = None


@dataclass
class AnimalCreateRequest:
    name: str
    tag_number: str | None = None
    lot: str | None = None
    species: str = 'cattle'
    sex: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    photo_url: str | None = None
    notes: str | None = None
    status: str = 'active'
    yard_id: int | None = None


@dataclass
class AnimalUpdateRequest(PatchRequest):
    name: str = UNSET
    tag_number: str | None = UNSET
    lot: str | None = UNSET
    species: str = UNSET
    sex: str | None = UNSET
    breed: str | None = UNSET
    birth_date: date | None = UNSET
    photo_url: str | None = UNSET
    notes: str | None = UNSET
    status: str = UNSET
    yard_id: int | None = UNSET


@dataclass
class TrackRequest:
    hours: int = 24
