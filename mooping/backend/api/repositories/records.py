"""Typed rows returned by the raw-SQL repositories.

Each SELECT must return exactly the fields of its record; `from_row` fails
loudly if a column is renamed or missing, instead of breaking callers later.
"""
import json
from dataclasses import dataclass, fields
from datetime import date, datetime
from typing import Any


class RecordMismatch(RuntimeError):
    pass


def from_row(cls, row):
    expected = {f.name for f in fields(cls)}
    got = set(row)
    if expected != got:
        raise RecordMismatch(
            f'{cls.__name__}: faltan {sorted(expected - got)}, sobran {sorted(got - expected)}'
        )
    return cls(**row)


@dataclass
class ProductRecord:
    id: str
    name: str
    subtitle: str
    badge: str | None
    items: tuple
    price: float
    currency: str
    free_shipping: bool


@dataclass
class MembershipRecord:
    organization_id: int
    organization_name: str
    role: str
    active: bool


@dataclass
class YardRecord:
    id: int
    name: str
    area_ha: float
    boundary: dict
    animal_count: int


@dataclass
class PointStatusRecord:
    inside: bool
    distance_m: float


@dataclass
class AnimalRecord:
    id: int
    name: str
    tag_number: str | None
    lot: str | None
    species: str
    sex: str | None
    breed: str | None
    birth_date: date | None
    photo_url: str | None
    notes: str | None
    status: str
    created_at: datetime
    yard_id: int | None
    yard_name: str | None
    device_id: int | None
    device_label: str | None
    device_uid: str | None
    battery_pct: float | None
    last_rssi_dbm: int | None
    last_seen_at: datetime | None
    tx_interval_s: int | None
    firmware_version: str | None
    lat: float | None
    lng: float | None
    position_at: datetime | None
    speed_mps: float | None
    heading_deg: float | None
    temp_body_c: float | None
    activity: float | None
    inside_geofence: bool | None
    distance_outside_m: float | None
    open_alerts: int


@dataclass
class TrackPointRecord:
    recorded_at: datetime
    lat: float
    lng: float
    speed_mps: float | None
    heading_deg: float | None
    temp_body_c: float | None


@dataclass
class ReportingDayRecord:
    date: date
    reporting: int


@dataclass
class DeviceRecord:
    id: int
    device_uid: str
    label: str | None
    hardware_version: str | None
    firmware_version: str | None
    battery_model: str | None
    tx_interval_s: int
    storage_location: str | None
    battery_pct: float | None
    last_rssi_dbm: int | None
    last_seen_at: datetime | None
    created_at: datetime
    animal_id: int | None
    animal_name: str | None
    animal_breed: str | None
    animal_lot: str | None
    yard_name: str | None
    inside_geofence: bool | None
    geofence_alert_since: datetime | None
    no_signal: bool
    low_battery: bool


@dataclass
class OfflineDeviceRecord:
    device_id: int
    organization_id: int
    last_seen_at: datetime | None
    animal_id: int
    yard_id: int | None


@dataclass
class LocationRecord:
    lat: float
    lng: float
    recorded_at: datetime


@dataclass
class GatewayRecord:
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


@dataclass
class MotionRecord:
    distance_m: float
    seconds: float
    heading_deg: float | None


@dataclass
class AlertRecord:
    id: int
    type: str
    severity: str
    status: str
    message: str | None
    metadata: Any
    triggered_at: datetime
    resolved_at: datetime | None
    updated_at: datetime
    animal_id: int | None
    animal_name: str | None
    animal_tag: str | None
    animal_breed: str | None
    animal_lot: str | None
    animal_birth_date: date | None
    device_id: int | None
    device_label: str | None
    device_uid: str | None
    device_battery_pct: float | None
    device_rssi_dbm: int | None
    device_last_seen_at: datetime | None
    yard_id: int | None
    yard_name: str | None
    assigned_to_id: int | None
    assigned_to_name: str | None
    resolved_by_id: int | None
    resolved_by_name: str | None
    lat: float | None
    lng: float | None
    speed_mps: float | None
    heading_deg: float | None
    urgency_rank: int

    def __post_init__(self):
        # Raw SQL returns jsonb as text (Django disables psycopg's JSON loader).
        if isinstance(self.metadata, str):
            self.metadata = json.loads(self.metadata)
