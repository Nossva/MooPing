from api.dto.response.notification_response import NotificationSettingsResponse
from api.repositories import notification_repository


def get_settings(organization_id, user):
    return NotificationSettingsResponse.from_entity(notification_repository.get(organization_id, user.id))


def update_settings(organization_id, user, request):
    """request: NotificationSettingsUpdateRequest (only the sent fields change)."""
    return NotificationSettingsResponse.from_entity(
        notification_repository.save(organization_id, user.id, **request.changes())
    )
