from dataclasses import dataclass

from api.dto.request.base import UNSET, PatchRequest


@dataclass
class NotificationSettingsUpdateRequest(PatchRequest):
    alarm_sound: bool = UNSET
    notify_geofence: bool = UNSET
    notify_health: bool = UNSET
    notify_equipment: bool = UNSET
    channel_push: bool = UNSET
    channel_email: bool = UNSET
    channel_sms: bool = UNSET
