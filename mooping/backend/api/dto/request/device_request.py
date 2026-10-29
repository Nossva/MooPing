from dataclasses import dataclass
from datetime import date

from api.dto.request.base import UNSET, PatchRequest


@dataclass
class DeviceListRequest:
    search: str | None = None
    filter: str | None = None          # alert | stock | no_signal | needs_attention
    limit: int | None = None


@dataclass
class DevicePairRequest:
    device_uid: str
    label: str | None = None
    hardware_version: str | None = None
    firmware_version: str | None = None
    battery_model: str | None = None
    storage_location: str | None = None

    def fields_to_set(self):
        """Optional attributes the client sent (device_uid excluded)."""
        values = {
            'label': self.label, 'hardware_version': self.hardware_version,
            'firmware_version': self.firmware_version, 'battery_model': self.battery_model,
            'storage_location': self.storage_location,
        }
        return {k: v for k, v in values.items() if v is not None}


@dataclass
class DeviceUpdateRequest(PatchRequest):
    label: str = UNSET
    hardware_version: str = UNSET
    firmware_version: str = UNSET
    battery_model: str = UNSET
    tx_interval_s: int = UNSET
    storage_location: str | None = UNSET


@dataclass
class AssignRequest:
    animal_id: int


@dataclass
class UnassignRequest:
    storage_location: str | None = None


@dataclass
class MaintenanceRequest:
    scheduled_for: date
    kind: str = 'battery_replacement'
    notes: str | None = None
