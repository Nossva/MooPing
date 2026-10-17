from dataclasses import dataclass
from datetime import datetime


@dataclass
class GatewayResponse:
    id: int
    gateway_uid: str
    name: str | None
    kind: str
    power_source: str | None
    battery_pct: float | None
    radio: str | None
    coverage_ha: float | None
    last_seen_at: datetime | None
    lat: float | None
    lng: float | None
    online: bool

    @classmethod
    def from_record(cls, r):
        return cls(r.id, r.gateway_uid, r.name, r.kind, r.power_source, r.battery_pct, r.radio,
                   r.coverage_ha, r.last_seen_at, r.lat, r.lng, r.online)
