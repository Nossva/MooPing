from dataclasses import dataclass


@dataclass
class AlertListRequest:
    status: str | None = None          # open | all | pending | assigned | in_progress | resolved
    category: str | None = None        # critical | sanitary | equipment
    since: str | None = None           # today (resolved alerts)
    sort: str = 'urgency'              # urgency | recent
    animal_id: int | None = None
    device_id: int | None = None


@dataclass
class AlertUpdateRequest:
    status: str | None = None
    assigned_to: int | None = None


@dataclass
class NoteCreateRequest:
    body: str
