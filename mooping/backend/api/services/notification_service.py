from api.repositories import notification_repository
from api.services.errors import InvalidInput

FIELDS = ('alarm_sound', 'notify_geofence', 'notify_health', 'notify_equipment',
          'channel_push', 'channel_email', 'channel_sms')
DEFAULTS = {'alarm_sound': True, 'notify_geofence': True, 'notify_health': True,
            'notify_equipment': True, 'channel_push': True, 'channel_email': False, 'channel_sms': False}


def _as_dict(settings):
    if settings is None:
        return dict(DEFAULTS)
    return {name: getattr(settings, name) for name in FIELDS}


def get_settings(organization_id, user):
    return _as_dict(notification_repository.get(organization_id, user.id))


def update_settings(organization_id, user, **fields):
    unknown = set(fields) - set(FIELDS)
    if unknown:
        raise InvalidInput(f'Campos desconocidos: {", ".join(sorted(unknown))}')
    return _as_dict(notification_repository.save(organization_id, user.id, **fields))
