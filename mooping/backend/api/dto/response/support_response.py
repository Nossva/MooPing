"""Response of the Soporte screen: support contacts + a diagnostic of the field."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class SupportContactsResponse:
    whatsapp: str | None
    email: str | None
    phone: str | None
    hours: str | None


@dataclass
class SupportServerResponse:
    name: str
    server_time: datetime


@dataclass
class SupportLinkResponse:
    online: bool
    last_packet_at: datetime | None
    radio: str | None


@dataclass
class SupportGatewayResponse:
    name: str
    gateway_uid: str
    kind: str                          # gateway | repeater
    online: bool
    last_seen_at: datetime | None

    @classmethod
    def from_record(cls, r):
        return cls(r.name, r.gateway_uid, r.kind, r.online, r.last_seen_at)


@dataclass
class SupportCollarsResponse:
    total: int
    assigned: int
    no_signal: int


@dataclass
class SupportProblemCollarResponse:
    label: str | None
    device_uid: str
    animal_name: str | None
    state: str                         # alert | no_signal
    last_seen_at: datetime | None

    @classmethod
    def from_device(cls, d):
        """d: DeviceResponse"""
        return cls(d.label, d.device_uid, d.animal.name if d.animal else None, d.state, d.last_seen_at)


@dataclass
class SupportDiagnosticResponse:
    organization: str
    server: SupportServerResponse
    link: SupportLinkResponse
    gateways: list[SupportGatewayResponse]
    collars: SupportCollarsResponse
    problem_collars: list[SupportProblemCollarResponse]
    open_alerts: dict[str, int]        # critical | sanitary | equipment -> count


@dataclass
class SupportRequestResponse:
    id: int
    category: str
    message: str
    created_at: datetime
    emailed: bool                      # False: saved, but the email didn't go out

    @classmethod
    def from_entity(cls, r):
        return cls(r.id, r.category, r.message, r.created_at, r.email_sent_at is not None)


@dataclass
class SupportResponse:
    contacts: SupportContactsResponse
    diagnostic: SupportDiagnosticResponse
