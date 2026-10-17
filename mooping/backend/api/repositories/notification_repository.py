from api.entities import NotificationSettings


def get(organization_id, user_id):
    return NotificationSettings.objects.filter(organization_id=organization_id, user_id=user_id).first()


def save(organization_id, user_id, **fields):
    settings, _ = NotificationSettings.objects.get_or_create(organization_id=organization_id, user_id=user_id)
    for name, value in fields.items():
        setattr(settings, name, value)
    settings.save()
    return settings
