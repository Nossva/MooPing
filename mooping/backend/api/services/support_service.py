import logging

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from api.dto.request.device_request import DeviceListRequest
from api.dto.response.support_response import (
    SupportCollarsResponse,
    SupportContactsResponse,
    SupportDiagnosticResponse,
    SupportGatewayResponse,
    SupportLinkResponse,
    SupportProblemCollarResponse,
    SupportRequestResponse,
    SupportResponse,
    SupportServerResponse,
)
from api.dto.response.base import to_json
from api.repositories import gateway_repository, organization_repository, support_repository
from api.services import alert_service, device_service, infrastructure_service, status_service
from api.services.errors import InvalidInput

log = logging.getLogger(__name__)

# Collars listed in the diagnostic (the message has to fit in a WhatsApp text).
PROBLEM_COLLARS = 10
# "Mis reclamos" on the Soporte screen.
RECENT_REQUESTS = 10

CATEGORY_LABEL = {'collar': 'Collar', 'gateway': 'Gateway / conexión', 'app': 'App / cuenta', 'other': 'Otro'}
ROLE_LABEL = {'owner': 'Dueño', 'user': 'Usuario'}
COLLAR_STATE = {'no_signal': 'Sin señal', 'low_battery': 'Batería baja', 'alert': 'Fuera del perímetro'}


def contacts():
    return SupportContactsResponse(
        whatsapp=settings.SUPPORT_WHATSAPP or None,
        email=settings.SUPPORT_EMAIL or None,
        phone=settings.SUPPORT_PHONE or None,
        hours=settings.SUPPORT_HOURS or None,
    )


def diagnostic(organization_id, scope=None):
    """Soporte screen. Open to every member: with a scope, collars and alerts
    cover only the visible animals (gateways are shared, as in status/)."""
    status = status_service.status(organization_id, scope)
    infra = infrastructure_service.summary(organization_id, scope)
    problems = device_service.list_devices(
        organization_id, DeviceListRequest(filter='needs_attention', limit=PROBLEM_COLLARS), scope,
    ).items
    return SupportDiagnosticResponse(
        organization=organization_repository.get(organization_id).name,
        server=SupportServerResponse(settings.MOOPING_SERVER_NAME, status.server_time),
        link=SupportLinkResponse(status.online, status.last_packet_at, status.radio),
        gateways=[SupportGatewayResponse.from_record(g) for g in gateway_repository.list_by_org(organization_id)],
        collars=SupportCollarsResponse(
            total=infra.collars.total,
            assigned=infra.collars.assigned,
            no_signal=infra.collars.no_signal,
            low_battery=infra.batteries.low_count,
        ),
        problem_collars=[SupportProblemCollarResponse.from_device(d) for d in problems],
        open_alerts=alert_service.summary(organization_id, scope).by_category,
    )


def support(organization_id, scope=None):
    """Soporte screen: contacts + diagnostic."""
    return SupportResponse(contacts=contacts(), diagnostic=diagnostic(organization_id, scope))


def list_requests(organization_id, user):
    """The member's own reclamos, newest first."""
    rows = support_repository.list_by_user(organization_id, user.id, RECENT_REQUESTS)
    return [SupportRequestResponse.from_entity(r) for r in rows]


def create_request(organization_id, user, role, request, user_agent=None, scope=None):
    """request: SupportRequestCreateRequest. Saves the reclamo with the current
    diagnostic and emails it to SUPPORT_EMAIL. A failed email doesn't lose it:
    it stays saved with email_error (the response says emailed: false)."""
    message = request.message.strip()
    if not message:
        raise InvalidInput('Contanos qué pasa antes de enviar.')
    diag = diagnostic(organization_id, scope)
    saved = support_repository.create(organization_id, user.id, request.category, message, to_json(diag), user_agent)

    if not settings.SUPPORT_EMAIL:
        support_repository.mark_email(saved, error='SUPPORT_EMAIL no configurado')
    else:
        email = EmailMessage(
            subject=f'[MooPing #{saved.id}] {CATEGORY_LABEL[saved.category]} · {diag.organization}: {_first_line(message)}',
            body=_email_body(saved, user, role, message, diag, user_agent),
            to=[settings.SUPPORT_EMAIL],
            reply_to=[user.email],  # "Responder" le escribe directo al usuario
        )
        try:
            email.send()
            support_repository.mark_email(saved, sent_at=timezone.now())
        except Exception as error:  # SMTP down, bad credentials, timeout...
            log.exception('Support request %s: email failed', saved.id)
            support_repository.mark_email(saved, error=str(error)[:500])
    return SupportRequestResponse.from_entity(saved)


def _first_line(message, length=60):
    line = message.splitlines()[0]
    return line if len(line) <= length else line[:length - 1] + '…'


def _when(value):
    return timezone.localtime(value).strftime('%d/%m/%Y %H:%M') if value else 'nunca'


def _email_body(saved, user, role, message, d, user_agent):
    gateways = [f'  - {g.name} ({g.gateway_uid}): ' + ('conectado' if g.online else f'desconectado, visto {_when(g.last_seen_at)}')
                for g in d.gateways]
    collars = [f'  - #{c.label or c.device_uid} ({c.animal_name or "sin animal"}): {COLLAR_STATE.get(c.state, c.state)}'
               + (f', batería {round(c.battery_pct)}%' if c.battery_pct is not None else '')
               + f', último dato {_when(c.last_seen_at)}'
               for c in d.problem_collars]
    alerts = d.open_alerts
    return '\n'.join([
        message,
        '',
        '— Reclamo —',
        f'Número: #{saved.id}',
        f'Tipo: {CATEGORY_LABEL[saved.category]}',
        f'Establecimiento: {d.organization}',
        f'Usuario: {user.name} <{user.email}>' + (f', tel. {user.phone}' if user.phone else '') + f' ({ROLE_LABEL.get(role, role)})',
        f'Enviado: {_when(saved.created_at)}',
        '',
        '— Diagnóstico —',
        f'Servidor: {d.server.name}',
        f'Enlace {d.link.radio or "LoRa"}: ' + ('en línea' if d.link.online else 'sin datos')
        + f', último dato {_when(d.link.last_packet_at)}',
        'Gateways:',
        *(gateways or ['  (ninguno)']),
        f'Collares: {d.collars.assigned} en uso de {d.collars.total}, {d.collars.no_signal} sin señal, '
        f'{d.collars.low_battery} con batería baja',
        *(['Para revisar:', *collars] if collars else []),
        f'Alertas abiertas: {alerts["critical"]} críticas, {alerts["sanitary"]} sanitarias, '
        f'{alerts["equipment"]} de equipos',
        f'Navegador: {user_agent or "—"}',
    ])
