from dataclasses import dataclass
from datetime import datetime

from api.dto.response.base import Ref, ref


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
    heard_devices: int

    @classmethod
    def from_record(cls, r, heard_devices=0):
        return cls(r.id, r.gateway_uid, r.name, r.kind, r.power_source, r.battery_pct, r.radio,
                   r.coverage_ha, r.last_seen_at, r.lat, r.lng, r.online, heard_devices)


@dataclass
class HeardDeviceResponse:
    """A collar whose readings came in through the gateway lately."""
    id: int
    device_uid: str
    label: str | None
    owned: bool
    animal: Ref | None
    animal_tag: str | None
    last_heard_at: datetime

    @classmethod
    def from_record(cls, r):
        return cls(r.id, r.device_uid, r.label, r.owned, ref(r.animal_id, r.animal_name), r.animal_tag,
                   r.last_heard_at)
