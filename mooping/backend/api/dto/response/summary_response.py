"""Responses of the screen summaries: status bar, Inicio, Monitoreo, Equipos."""
from dataclasses import dataclass
from datetime import date, datetime

from api.dto.response.alert_response import AlertResponse
from api.dto.response.base import Ref
from api.dto.response.yard_response import YardResponse


@dataclass
class StatusResponse:
    online: bool
    last_packet_at: datetime | None
    radio: str | None
    gateways_online: int
    gateways_total: int
    open_alerts: int
    server_time: datetime


@dataclass
class PendingByCategoryResponse:
    urgent: int
    sanitary: int
    equipment: int


@dataclass
class HealthPointResponse:
    date: date
    pct: float | None


@dataclass
class HerdHealthResponse:
    animals_total: int
    animals_reporting: int
    pct: float | None
    series: list[HealthPointResponse]


@dataclass
class DashboardResponse:
    organization: Ref
    pending_total: int
    pending_by_category: PendingByCategoryResponse
    top_alert: AlertResponse | None
    herd_health: HerdHealthResponse


@dataclass
class HerdResponse:
    total: int
    with_position: int
    inside_geofence: int
    outside_geofence: int
    safe_pct: float | None


@dataclass
class MonitoringAlertsResponse:
    active: int
    geofence: int
    health: int


@dataclass
class GatewayCardResponse:
    name: str | None
    battery_pct: float | None
    power_source: str | None
    radio: str | None
    online: bool


@dataclass
class MonitoringResponse:
    yard: YardResponse | None
    herd: HerdResponse
    alerts: MonitoringAlertsResponse
    gateway: GatewayCardResponse | None


@dataclass
class CollarsCardResponse:
    total: int
    active: int
    assigned: int
    no_signal: int
    in_stock: int
    operative_pct: float | None


@dataclass
class GatewaysCardResponse:
    total: int
    online: int
    coverage_ha: float | None


@dataclass
class RepeatersCardResponse:
    total: int
    online: int
    names: list[str]


@dataclass
class ServerCardResponse:
    name: str
    status: str


@dataclass
class InfrastructureResponse:
    collars: CollarsCardResponse
    gateways: GatewaysCardResponse
    repeaters: RepeatersCardResponse
    server: ServerCardResponse
    last_sync_at: datetime | None
