from dataclasses import dataclass
from datetime import date, datetime

from api.dto.response.alert_response import AlertResponse
from api.dto.response.base import PositionResponse, Ref, age_months, compass, geofence_status, kmh, ref


@dataclass
class AnimalDeviceResponse:
    id: int
    label: str | None
    device_uid: str
    battery_pct: float | None
    rssi_dbm: int | None
    last_seen_at: datetime | None
    tx_interval_s: int | None
    firmware_version: str | None


@dataclass
class AnimalResponse:
    id: int
    name: str
    tag_number: str | None
    lot: str | None
    species: str
    sex: str | None
    breed: str | None
    birth_date: date | None
    age_months: int | None
    photo_url: str | None
    status: str
    yard: Ref | None
    geofence_status: str
    distance_outside_m: float | None
    health_status: str
    open_alerts: int
    position: PositionResponse | None
    speed_kmh: float | None
    heading_deg: float | None
    heading_label: str | None
    temp_body_c: float | None
    device: AnimalDeviceResponse | None

    @classmethod
    def from_record(cls, r):
        return cls(
            id=r.id, name=r.name, tag_number=r.tag_number, lot=r.lot, species=r.species, sex=r.sex,
            breed=r.breed, birth_date=r.birth_date, age_months=age_months(r.birth_date),
            photo_url=r.photo_url, status=r.status, yard=ref(r.yard_id, r.yard_name),
            geofence_status=geofence_status(r.inside_geofence),
            distance_outside_m=r.distance_outside_m if r.inside_geofence is False else None,
            health_status='alert' if r.open_alerts else 'optimal',
            open_alerts=r.open_alerts,
            position=PositionResponse(r.lat, r.lng, r.position_at) if r.lat is not None else None,
            speed_kmh=kmh(r.speed_mps), heading_deg=r.heading_deg, heading_label=compass(r.heading_deg),
            temp_body_c=r.temp_body_c,
            device=AnimalDeviceResponse(r.device_id, r.device_label, r.device_uid, r.battery_pct,
                                        r.last_rssi_dbm, r.last_seen_at,
                                        r.tx_interval_s, r.firmware_version) if r.device_id else None,
        )


@dataclass
class TempRangeResponse:
    min: float
    max: float


@dataclass
class AnimalDetailResponse(AnimalResponse):
    """Ficha del animal: same as the list item, but open_alerts is the list."""
    open_alerts: list[AlertResponse]
    notes: str | None
    temp_range_c: TempRangeResponse
    temp_in_range: bool | None
    activity_today_km: float
    rumination_4h_min: float | None

    @classmethod
    def build(cls, record, alert_records, temp_min, temp_max, distance_today_m, rumination_4h_min):
        base = vars(AnimalResponse.from_record(record))
        base['open_alerts'] = [AlertResponse.from_record(a) for a in alert_records]
        temp = record.temp_body_c
        return cls(
            **base,
            notes=record.notes,
            temp_range_c=TempRangeResponse(temp_min, temp_max),
            temp_in_range=None if temp is None else temp_min <= temp <= temp_max,
            activity_today_km=round(distance_today_m / 1000, 2),
            rumination_4h_min=rumination_4h_min,
        )


@dataclass
class AnimalPositionResponse:
    id: int
    name: str
    lat: float
    lng: float
    recorded_at: datetime | None
    geofence_status: str
    has_alert: bool

    @classmethod
    def from_record(cls, r):
        return cls(r.id, r.name, r.lat, r.lng, r.position_at, geofence_status(r.inside_geofence), r.open_alerts > 0)


@dataclass
class TrackPointResponse:
    recorded_at: datetime
    lat: float
    lng: float
    speed_kmh: float | None
    heading_deg: float | None
    temp_body_c: float | None

    @classmethod
    def from_record(cls, p):
        return cls(p.recorded_at, p.lat, p.lng, kmh(p.speed_mps), p.heading_deg, p.temp_body_c)


@dataclass
class TrackResponse:
    animal_id: int
    hours: int
    points: list[TrackPointResponse]
