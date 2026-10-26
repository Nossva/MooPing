"""Data scope of a member restricted to some potreros / animals.

`None` everywhere means "no restriction" (owners, and users with all_yards).
A Scope sees the animals in `yard_ids` plus the loose `animal_ids`, and
through them their collars, alerts and readings.
"""
from dataclasses import dataclass

from django.db.models import Q


@dataclass(frozen=True)
class Scope:
    yard_ids: tuple[int, ...]
    animal_ids: tuple[int, ...]


_VISIBLE_ANIMALS = '(SELECT id FROM animals WHERE yard_id = ANY(%s) OR id = ANY(%s))'


def _params(scope):
    return [list(scope.yard_ids), list(scope.animal_ids)]


def animal_sql(scope, animal_col):
    """(' AND ...', params) keeping rows whose animal is visible."""
    if scope is None:
        return '', []
    return f' AND {animal_col} IN {_VISIBLE_ANIMALS}', _params(scope)


def alert_sql(scope, animal_col, yard_col):
    """Alerts about a visible animal, or about a visible potrero with no animal."""
    if scope is None:
        return '', []
    return (f' AND ({animal_col} IN {_VISIBLE_ANIMALS}'
            f' OR ({animal_col} IS NULL AND {yard_col} = ANY(%s)))',
            _params(scope) + [list(scope.yard_ids)])


def yard_sql(scope, yard_col):
    if scope is None:
        return '', []
    return f' AND {yard_col} = ANY(%s)', [list(scope.yard_ids)]


def animal_q(scope, prefix=''):
    """ORM filter for Animal (prefix='') or a model with an `animal` FK (prefix='animal__')."""
    if scope is None:
        return Q()
    return Q(**{f'{prefix}yard_id__in': scope.yard_ids}) | Q(**{f'{prefix}id__in': scope.animal_ids})


def alert_q(scope):
    if scope is None:
        return Q()
    return animal_q(scope, 'animal__') | Q(animal__isnull=True, yard_id__in=scope.yard_ids)
