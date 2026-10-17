from api.repositories import animal_repository, gateway_repository, yard_repository
from api.services import alert_service
from api.services.errors import NotFound


def summary(organization_id, yard_id=None):
    """Cards on top of the Monitoreo map: Rebaño, Alertas, Gateway."""
    if yard_id is not None and yard_repository.get(organization_id, yard_id) is None:
        raise NotFound('Potrero no encontrado.')
    animals = animal_repository.list_rows(organization_id, yard_id=yard_id)
    located = [a for a in animals if a['inside_geofence'] is not None]
    inside = sum(1 for a in located if a['inside_geofence'])
    alerts = alert_service.summary(organization_id)
    gateways = [g for g in gateway_repository.list_by_org(organization_id) if g['kind'] == 'gateway']
    # Battery-powered gateways first: their charge is what the card is for.
    gateways.sort(key=lambda g: g['battery_pct'] is None)
    main = gateways[0] if gateways else None

    return {
        'yard': yard_repository.get(organization_id, yard_id) if yard_id else None,
        'herd': {
            'total': len(animals),
            'with_position': len(located),
            'inside_geofence': inside,
            'outside_geofence': len(located) - inside,
            'safe_pct': round(100 * inside / len(located), 1) if located else None,
        },
        'alerts': {
            'active': alerts['open_total'],
            'geofence': alerts['by_type'].get('geofence_exit', 0),
            'health': alerts['by_category']['sanitary'],
        },
        'gateway': {
            'name': main['name'],
            'battery_pct': main['battery_pct'],
            'power_source': main['power_source'],
            'radio': main['radio'],
            'online': main['online'],
        } if main else None,
    }
