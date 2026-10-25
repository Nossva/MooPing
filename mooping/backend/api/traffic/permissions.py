"""Role checks (memberships.role). Writes are owner-only by default (see
REST_FRAMEWORK in config/settings.py); views open to every member opt in
with @permission_classes([IsAuthenticated, IsMember])."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from api.traffic.context import is_owner, membership


class IsMember(BasePermission):
    """Any member of the establecimiento can read and write."""

    def has_permission(self, request, view):
        membership(request)  # raises Forbidden if the user has no access
        return True


class IsOwnerOrReadOnly(BasePermission):
    """Members read; only the owner ("Dueño") creates, edits or deletes."""

    message = 'Solo el dueño puede hacer esto.'

    def has_permission(self, request, view):
        if request.user is None:
            return True  # AllowAny views (login, telemetry...) handle it
        if request.method in SAFE_METHODS:
            return True
        return is_owner(request)
