from api.dto.response.summary_response import (
    GatewayCardResponse,
    HerdResponse,
    MonitoringAlertsResponse,
    MonitoringResponse,
)
from api.dto.response.yard_response import YardResponse
from api.repositories import animal_repository, gateway_repository, yard_repository
from api.services import alert_service
from api.services.errors import NotFound


def summary(organization_id, request):
    """request: YardQueryRequest. Cards on top of the Monitoreo map: Rebaño,
    Alertas, Gateway."""
    yard = None
    if request.yard_id is not None:
        yard = yard_repository.get(organization_id, request.yard_id)
        if yard is None:
            raise NotFound('Potrero no encontrado.')
    animals = animal_repository.list_rows(organization_id, yard_id=request.yard_id)
    located = [a for a in animals if a.inside_geofence is not None]
    inside = sum(1 for a in located if a.inside_geofence)
    alerts = alert_service.summary(organization_id)
    gateways = [g for g in gateway_repository.list_by_org(organization_id) if g.kind == 'gateway']
    # Battery-powered gateways first: their charge is what the card is for.
    gateways.sort(key=lambda g: g.battery_pct is None)
    main = gateways[0] if gateways else None

    return MonitoringResponse(
        yard=YardResponse.from_record(yard) if yard else None,
        herd=HerdResponse(
            total=len(animals),
            with_position=len(located),
            inside_geofence=inside,
            outside_geofence=len(located) - inside,
            safe_pct=round(100 * inside / len(located), 1) if located else None,
        ),
        alerts=MonitoringAlertsResponse(
            active=alerts.open_total,
            geofence=alerts.by_type.get('geofence_exit', 0),
            health=alerts.by_category['sanitary'],
        ),
        gateway=GatewayCardResponse(main.name, main.battery_pct, main.power_source, main.radio, main.online)
        if main else None,
    )
