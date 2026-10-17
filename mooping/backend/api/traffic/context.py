from api.services import auth_service


def organization_id(request):
    """Establecimiento the request acts on: X-Organization-Id header, or the
    user's first one."""
    return auth_service.resolve_organization(request.user, request.headers.get('X-Organization-Id'))
