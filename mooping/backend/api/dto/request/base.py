"""Shared pieces of the request DTOs."""
from dataclasses import fields


class DtoValidationError(ValueError):
    """Input that cannot be turned into a request DTO (traffic answers 400)."""


class _Unset:
    """Marks a PATCH field the client did not send (different from null)."""

    def __repr__(self):
        return 'UNSET'

    def __bool__(self):
        return False


UNSET = _Unset()


class PatchRequest:
    """Base for partial-update requests: fields default to UNSET."""

    def changes(self):
        return {f.name: getattr(self, f.name) for f in fields(self) if getattr(self, f.name) is not UNSET}
