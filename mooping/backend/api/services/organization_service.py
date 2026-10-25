from api.dto.response.member_response import OrganizationSettingsResponse
from api.repositories import organization_repository
from api.services.errors import InvalidInput, NotFound

# Alert thresholds: field -> (min, max, error message)
_LIMITS = {
    'fever_threshold_c': (37, 42, 'El límite de fiebre debe estar entre 37 y 42 °C.'),
    'low_battery_pct': (5, 50, 'La batería baja debe estar entre 5 y 50 %.'),
    'no_signal_minutes': (5, 1440, 'Los minutos sin señal deben estar entre 5 y 1440.'),
}


def _get(organization_id):
    org = organization_repository.get(organization_id)
    if org is None:
        raise NotFound('Establecimiento no encontrado.')
    return org


def get_settings(organization_id):
    return OrganizationSettingsResponse.from_entity(_get(organization_id))


def update_settings(organization_id, request):
    """request: OrganizationUpdateRequest (only the sent fields change)."""
    changes = request.changes()
    if 'name' in changes:
        changes['name'] = (changes['name'] or '').strip()
        if not changes['name']:
            raise InvalidInput('El nombre no puede quedar vacío.')
    if 'vet_phone' in changes:
        changes['vet_phone'] = (changes['vet_phone'] or '').strip() or None
    for field, (low, high, message) in _LIMITS.items():
        if field in changes and not low <= changes[field] <= high:
            raise InvalidInput(message)
    org = _get(organization_id)
    if changes:
        organization_repository.update(org, **changes)
    return OrganizationSettingsResponse.from_entity(org)
