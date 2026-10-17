from api.dto.response.alert_response import AlertResponse
from api.dto.response.base import Ref
from api.dto.response.summary_response import (
    DashboardResponse,
    HealthPointResponse,
    HerdHealthResponse,
    PendingByCategoryResponse,
)
from api.repositories import alert_repository, animal_repository, organization_repository
from api.services import alert_service

REPORTING_MINUTES = 30
SERIES_DAYS = 7


def _pct(part, total):
    return round(100 * part / total, 1) if total else None


def summary(organization_id):
    """Inicio: "Hoy tenés N cosas para atender", salud del rodeo and its trend."""
    org = organization_repository.get(organization_id)
    alerts = alert_service.summary(organization_id)
    top = alert_repository.list_rows(organization_id, status='open', sort='urgency', limit=1)

    total = animal_repository.count_active(organization_id)
    reporting = animal_repository.count_reporting(organization_id, max(REPORTING_MINUTES, org.no_signal_minutes))
    series = animal_repository.reporting_series(organization_id, SERIES_DAYS)

    return DashboardResponse(
        organization=Ref(org.id, org.name),
        pending_total=alerts.open_total,
        pending_by_category=PendingByCategoryResponse(
            urgent=alerts.by_category['critical'],
            sanitary=alerts.by_category['sanitary'],
            equipment=alerts.by_category['equipment'],
        ),
        top_alert=AlertResponse.from_record(top[0]) if top else None,
        herd_health=HerdHealthResponse(
            animals_total=total,
            animals_reporting=reporting,
            pct=_pct(reporting, total),
            series=[HealthPointResponse(p.date, _pct(p.reporting, total)) for p in series],
        ),
    )
