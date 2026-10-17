from api.repositories import alert_repository, animal_repository, organization_repository
from api.services import alert_service, formatting

REPORTING_MINUTES = 30
SERIES_DAYS = 7


def summary(organization_id):
    """Inicio: "Hoy tenés N cosas para atender", salud del rodeo and its trend."""
    org = organization_repository.get(organization_id)
    alerts = alert_service.summary(organization_id)
    top = alert_repository.list_rows(organization_id, status='open', sort='urgency', limit=1)

    total = animal_repository.count_active(organization_id)
    reporting = animal_repository.count_reporting(organization_id, max(REPORTING_MINUTES, org.no_signal_minutes))
    series = animal_repository.reporting_series(organization_id, SERIES_DAYS)

    return {
        'organization': {'id': org.id, 'name': org.name},
        'pending_total': alerts['open_total'],
        'pending_by_category': {
            'urgent': alerts['by_category']['critical'],
            'sanitary': alerts['by_category']['sanitary'],
            'equipment': alerts['by_category']['equipment'],
        },
        'top_alert': formatting.alert(top[0]) if top else None,
        'herd_health': {
            'animals_total': total,
            'animals_reporting': reporting,
            'pct': round(100 * reporting / total, 1) if total else None,
            'series': [
                {'date': p['date'], 'pct': round(100 * p['reporting'] / total, 1) if total else None}
                for p in series
            ],
        },
    }
