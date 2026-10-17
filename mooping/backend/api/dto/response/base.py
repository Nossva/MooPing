"""Shared pieces of the response DTOs and the presentation helpers."""
from dataclasses import asdict, dataclass, is_dataclass
from datetime import date, datetime


def to_json(dto):
    """Response DTO (or list of them) -> plain data for DRF's Response."""
    if isinstance(dto, list):
        return [to_json(item) for item in dto]
    return asdict(dto) if is_dataclass(dto) else dto


@dataclass
class Ref:
    id: int
    name: str | None


@dataclass
class LatLng:
    lat: float
    lng: float


@dataclass
class PositionResponse:
    lat: float
    lng: float
    recorded_at: datetime | None


def kmh(speed_mps):
    return None if speed_mps is None else round(speed_mps * 3.6, 1)


def compass(heading_deg):
    """'Este 94°' style label."""
    if heading_deg is None:
        return None
    names = ['Norte', 'Noreste', 'Este', 'Sureste', 'Sur', 'Suroeste', 'Oeste', 'Noroeste']
    return f'{names[int(((heading_deg % 360) + 22.5) // 45) % 8]} {round(heading_deg)}°'


def age_months(birth_date):
    if birth_date is None:
        return None
    today = date.today()
    return (today.year - birth_date.year) * 12 + today.month - birth_date.month


def geofence_status(inside):
    return 'unknown' if inside is None else ('inside' if inside else 'outside')


def ref(id_, name):
    return Ref(id_, name) if id_ is not None else None
