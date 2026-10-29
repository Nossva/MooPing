from dataclasses import dataclass
from datetime import datetime

from api.dto.response.base import LatLng, Ref, age_months, compass, kmh, ref
from api.entities import CATEGORY_BY_TYPE


@dataclass
class AlertAnimalResponse:
    id: int
    name: str
    tag_number: str | None
    breed: str | None
    lot: str | None
    age_months: int | None


@dataclass
class AlertDeviceResponse:
    id: int
    label: str | None
    device_uid: str
    last_seen_at: datetime | None


@dataclass
class AlertResponse:
    id: int
    type: str
    category: str
    severity: str
    status: str
    message: str | None
    metadata: dict
    triggered_at: datetime
    resolved_at: datetime | None
    animal: AlertAnimalResponse | None
    device: AlertDeviceResponse | None
    yard: Ref | None
    assigned_to: Ref | None
    resolved_by: Ref | None
    position: LatLng | None
    speed_kmh: float | None
    heading_label: str | None

    @classmethod
    def from_record(cls, r):
        return cls(
            id=r.id, type=r.type, category=CATEGORY_BY_TYPE[r.type], severity=r.severity,
            status=r.status, message=r.message, metadata=r.metadata,
            triggered_at=r.triggered_at, resolved_at=r.resolved_at,
            animal=AlertAnimalResponse(r.animal_id, r.animal_name, r.animal_tag, r.animal_breed,
                                       r.animal_lot, age_months(r.animal_birth_date)) if r.animal_id else None,
            device=AlertDeviceResponse(r.device_id, r.device_label, r.device_uid,
                                       r.device_last_seen_at) if r.device_id else None,
            yard=ref(r.yard_id, r.yard_name),
            assigned_to=ref(r.assigned_to_id, r.assigned_to_name),
            resolved_by=ref(r.resolved_by_id, r.resolved_by_name),
            position=LatLng(r.lat, r.lng) if r.lat is not None else None,
            speed_kmh=kmh(r.speed_mps),
            heading_label=compass(r.heading_deg),
        )


@dataclass
class NoteResponse:
    id: int
    body: str
    created_at: datetime
    user: Ref | None

    @classmethod
    def from_entity(cls, note):
        return cls(note.id, note.body, note.created_at,
                   Ref(note.user_id, note.user.name) if note.user_id else None)


@dataclass
class AlertDetailResponse(AlertResponse):
    notes: list[NoteResponse]

    @classmethod
    def build(cls, record, notes):
        base = AlertResponse.from_record(record)
        return cls(**vars(base), notes=[NoteResponse.from_entity(n) for n in notes])


@dataclass
class AlertSummaryResponse:
    open_total: int
    by_category: dict
    by_type: dict
    critical_unattended: int
    last_packet_at: datetime | None
