from dataclasses import dataclass


@dataclass
class NotificationSettingsResponse:
    alarm_sound: bool = True
    notify_geofence: bool = True
    notify_health: bool = True
    notify_equipment: bool = True
    channel_push: bool = True
    channel_email: bool = False
    channel_sms: bool = False

    @classmethod
    def from_entity(cls, settings):
        """Defaults when the user never saved settings."""
        if settings is None:
            return cls()
        return cls(settings.alarm_sound, settings.notify_geofence, settings.notify_health,
                   settings.notify_equipment, settings.channel_push, settings.channel_email,
                   settings.channel_sms)
