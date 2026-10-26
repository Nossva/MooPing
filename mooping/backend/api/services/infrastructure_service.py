from django.conf import settings

from api.dto.response.summary_response import (
    BatteriesCardResponse,
    CollarsCardResponse,
    GatewaysCardResponse,
    InfrastructureResponse,
    RepeatersCardResponse,
    ServerCardResponse,
)
from api.repositories import device_repository, gateway_repository, telemetry_repository, yard_repository


def summary(organization_id, scope=None):
    """Header cards of the Equipos screen. With a scope, the collar figures
    cover only the collars on visible animals; gateways are shared."""
    devices = device_repository.list_rows(organization_id, scope=scope)
    assigned = [d for d in devices if d.animal_id is not None]
    reporting = [d for d in assigned if not d.no_signal]
    batteries = [d.battery_pct for d in assigned if d.battery_pct is not None]
    gateways = gateway_repository.list_by_org(organization_id)
    bases = [g for g in gateways if g.kind == 'gateway']
    repeaters = [g for g in gateways if g.kind == 'repeater']
    coverage = sum(g.coverage_ha or 0 for g in bases) or yard_repository.total_area_ha(organization_id)
    last_sync = max((g.last_seen_at for g in gateways if g.last_seen_at), default=None) \
        or telemetry_repository.last_packet_at(organization_id)

    return InfrastructureResponse(
        collars=CollarsCardResponse(
            total=len(devices),
            active=len(reporting),
            assigned=len(assigned),
            no_signal=len(assigned) - len(reporting),
            in_stock=len(devices) - len(assigned),
            operative_pct=round(100 * len(reporting) / len(assigned), 1) if assigned else None,
        ),
        gateways=GatewaysCardResponse(total=len(bases), online=sum(g.online for g in bases), coverage_ha=coverage),
        repeaters=RepeatersCardResponse(
            total=len(repeaters), online=sum(g.online for g in repeaters), names=[g.name for g in repeaters],
        ),
        batteries=BatteriesCardResponse(
            average_pct=round(sum(batteries) / len(batteries)) if batteries else None,
            low_count=sum(1 for d in assigned if d.low_battery),
        ),
        server=ServerCardResponse(name=settings.MOOPING_SERVER_NAME, status='connected'),
        last_sync_at=last_sync,
    )
