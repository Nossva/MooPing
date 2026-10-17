from django.utils import timezone

from api.repositories import alert_repository, gateway_repository, telemetry_repository

# The status bar turns from "En línea" to "Sin datos" after this long.
ONLINE_SECONDS = 300


def status(organization_id):
    """Green bar on every screen ("Actualizado hace 12 s · LoRaWAN OK") and the
    bell / Alertas badge."""
    last_packet = telemetry_repository.last_packet_at(organization_id)
    gateways = [g for g in gateway_repository.list_by_org(organization_id) if g['kind'] == 'gateway']
    online = last_packet is not None and (timezone.now() - last_packet).total_seconds() <= ONLINE_SECONDS
    return {
        'online': online,
        'last_packet_at': last_packet,
        'radio': gateways[0]['radio'] if gateways else None,
        'gateways_online': sum(g['online'] for g in gateways),
        'gateways_total': len(gateways),
        'open_alerts': alert_repository.count_open(organization_id),
        'server_time': timezone.now(),
    }
