from api.services import access_service, auth_service


def membership(request):
    """MembershipRecord (organization + role) the request acts on:
    X-Organization-Id header, or the user's first establecimiento. Cached per
    request so permissions and views resolve it once."""
    cached = getattr(request, '_mooping_membership', None)
    if cached is None:
        cached = auth_service.resolve_membership(request.user, request.headers.get('X-Organization-Id'))
        request._mooping_membership = cached
    return cached


def organization_id(request):
    return membership(request).organization_id


def is_owner(request):
    return membership(request).role == auth_service.OWNER


def access(request):
    """Sections and data scope of the member (access_service.Access), cached per request."""
    cached = getattr(request, '_mooping_access', None)
    if cached is None:
        m = membership(request)
        cached = access_service.for_member(m.organization_id, request.user.id, m.role)
        request._mooping_access = cached
    return cached


def scope(request):
    """Potreros/animals the member sees, for the repositories (None = all)."""
    return access(request).scope


def require_section(request, section):
    """Raises 403 unless the member can open `section` of the app."""
    access_service.require(access(request), section)
