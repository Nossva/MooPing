"""Dispara una alerta nueva de prueba para ver el aviso (pitido + notificación del navegador).

    python probar_alerta.py            # un animal "fuera del perímetro" (urgente)
    python probar_alerta.py fiebre     # un animal con fiebre (sanitaria)

Manda una lectura falsa de collar por el mismo camino que la telemetría real
(telemetry_service.ingest), así que se evalúan las mismas reglas de alertas.
Elige un animal con collar que todavía no tenga esa alerta abierta.

Para ver el aviso: tené la app abierta (con las alarmas activadas) y esperá hasta 15 s.
Después resolvé la alerta desde el Centro de Alertas, o volvé a cargar la demo
con `python start_con_demo.py --reset`.
"""
import subprocess
import sys

import start

# Corre dentro del contenedor del backend (manage.py shell).
SHELL_CODE = r'''
from django.db import connection
from django.utils import timezone
from api.dto.request.telemetry_request import TelemetryReadingRequest
from api.models import Alert, AnimalDevice
from api.services import telemetry_service

KIND = {kind!r}
alert_type = 'fever' if KIND == 'fiebre' else 'geofence_exit'
busy = set(Alert.objects.filter(type=alert_type).exclude(status='resolved').values_list('animal_id', flat=True))
links = AnimalDevice.objects.filter(unassigned_at__isnull=True, animal__status='active').select_related('animal', 'device')
if alert_type == 'geofence_exit':
    links = links.filter(animal__yard__isnull=False)
link = next((l for l in links.order_by('animal__name') if l.animal_id not in busy), None)
if link is None:
    raise SystemExit('No hay ningún animal con collar libre para esta prueba (todos ya tienen la alerta abierta).')

raw = {{'ID': link.device.device_uid, 'TS': timezone.now().isoformat(), 'TEMP': 38.6}}
if alert_type == 'fever':
    raw['TEMP'] = 41.2
else:
    # 500 m (aprox.) al este del borde del potrero, a la altura de su centro.
    with connection.cursor() as cur:
        cur.execute("""SELECT ST_XMax(boundary::geometry) + 0.005, ST_Y(ST_Centroid(boundary::geometry))
                       FROM yards WHERE id = %s""", [link.animal.yard_id])
        raw['LONG'], raw['LAT'] = cur.fetchone()

telemetry_service.ingest(TelemetryReadingRequest.from_payload(raw))
created = Alert.objects.filter(type=alert_type, animal_id=link.animal_id).exclude(status='resolved').first()
print(f'OK: alerta "{{created.message}}" (#{{created.id}}) para {{link.animal.name}}, collar {{link.device.label}}.')
'''


def main():
    kind = 'fiebre' if 'fiebre' in sys.argv[1:] else 'fuera'
    start.check_docker()
    command = ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'shell', '-c',
               SHELL_CODE.format(kind=kind)]
    # El contenedor escribe en UTF-8; sin esto, en Windows los acentos salen rotos.
    result = subprocess.run(command, cwd=start.ROOT, capture_output=True, encoding='utf-8', errors='replace')
    output = [line for line in result.stdout.splitlines() if 'objects imported' not in line]
    if result.returncode != 0:
        print('\n'.join(output), result.stderr, sep='\n', file=sys.stderr)
        sys.exit('No se pudo crear la alerta de prueba. ¿Está levantado MooPing (python start_con_demo.py)?')
    print('\n'.join(output))
    print('Si tenés la app abierta con las alarmas activadas, en menos de 15 s suena y aparece el aviso.')


if __name__ == '__main__':
    main()
