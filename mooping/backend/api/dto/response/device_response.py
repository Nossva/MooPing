from dataclasses import dataclass
from datetime import date, datetime

from api.dto.response.base import geofence_status
from api.entities import default_collar_label, device_state


@dataclass
class DeviceAnimalResponse:
    id: int
    name: str
    breed: str | None
    lot: str | None
    yard_name: str | None
    geofence_status: str


@dataclass
class DeviceResponse:
    id: int
    device_uid: str
    label: str | None
    state: str
    hardware_version: str | None
    firmware_version: str | None
    battery_model: str | None
    tx_interval_s: int
    last_seen_at: datetime | None
    storage_location: str | None
    geofence_alert_since: datetime | None
    animal: DeviceAnimalResponse | None

    @classmethod
    def from_record(cls, r):
        return cls(
            id=r.id, device_uid=r.device_uid, label=r.label,
            state=device_state(r.animal_id is not None, r.no_signal, r.geofence_alert_since is not None),
            hardware_version=r.hardware_version, firmware_version=r.firmware_version,
            battery_model=r.battery_model, tx_interval_s=r.tx_interval_s,
            last_seen_at=r.last_seen_at, storage_location=r.storage_location,
            geofence_alert_since=r.geofence_alert_since,
            animal=DeviceAnimalResponse(r.animal_id, r.animal_name, r.animal_breed, r.animal_lot,
                                        r.yard_name, geofence_status(r.inside_geofence)) if r.animal_id else None,
        )


@dataclass
class DetectedDeviceResponse:
    """A collar that is transmitting but nobody claimed yet ("Detectados sin vincular")."""
    device_uid: str
    suggested_label: str
    last_seen_at: datetime | None
    gateway_name: str

    @classmethod
    def from_record(cls, r):
        return cls(r.device_uid, default_collar_label(r.device_uid), r.last_seen_at, r.gateway_name)


@dataclass
class DeviceListResponse:
    counts: dict
    items: list[DeviceResponse]


@dataclass
class MaintenanceResponse:
    id: int
    device_id: int | None
    kind: str
    scheduled_for: date
    status: str
    notes: str | None

    @classmethod
    def from_entity(cls, task):
        return cls(task.id, task.device_id, task.kind, task.scheduled_for, task.status, task.notes)


@dataclass
class PendingCommandResponse:
    id: int
    command: str
    created_at: datetime

    @classmethod
    def from_entity(cls, command):
        return cls(command.id, command.command, command.created_at)


@dataclass
class DeviceDetailResponse(DeviceResponse):
    maintenance: list[MaintenanceResponse]
    pending_commands: list[PendingCommandResponse]

    @classmethod
    def build(cls, record, tasks, commands):
        return cls(
            **vars(DeviceResponse.from_record(record)),
            maintenance=[MaintenanceResponse.from_entity(t) for t in tasks],
            pending_commands=[PendingCommandResponse.from_entity(c) for c in commands],
        )
