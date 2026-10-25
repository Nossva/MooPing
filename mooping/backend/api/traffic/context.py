from api.services import auth_service


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
