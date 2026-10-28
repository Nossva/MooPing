import hmac
import json
import socket
import socketserver
import threading
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from api.services import alert_service
from api.traffic.telemetry_views import ingest_payload

NO_SIGNAL_CHECK_SECONDS = 60
# The Pi opens a connection per reading: anything slower or bigger isn't the Pi.
CONNECTION_TIMEOUT_SECONDS = 30
MAX_BUFFER_CHARS = 64 * 1024


def key_ok(item):
    """With TELEMETRY_API_KEY set, every reading must carry it as "KEY"
    (lora_receiver.c: TELEMETRY_KEY). Without it, anyone on the network could
    invent positions and trigger alerts."""
    expected = settings.TELEMETRY_API_KEY
    if not expected:
        return True
    provided = item.get('KEY') if isinstance(item, dict) else None
    return isinstance(provided, str) and hmac.compare_digest(provided.encode(), expected.encode())


def for_log(items):
    """The payload without the key, so it never ends up in the logs."""
    return json.dumps([{k: v for k, v in i.items() if k != 'KEY'} if isinstance(i, dict) else i for i in items])


def extract_json_payloads(buffer):
    """Splits a stream of concatenated JSON objects/arrays. Returns
    (complete payloads, unparsed remainder)."""
    payloads, start, depth, in_string, escaped = [], -1, 0, False, False
    for index, char in enumerate(buffer):
        if start == -1:
            if char in '{[':
                start, depth = index, 1
            continue
        if escaped:
            escaped = False
        elif char == '\\' and in_string:
            escaped = True
        elif char == '"':
            in_string = not in_string
        elif not in_string:
            if char in '{[':
                depth += 1
            elif char in '}]':
                depth -= 1
                if depth == 0:
                    payloads.append(buffer[start:index + 1])
                    start = -1
    return payloads, ('' if start == -1 else buffer[start:])


class TelemetryHandler(socketserver.BaseRequestHandler):
    """One TCP connection from lora_receiver.c (one or more JSON objects)."""

    def handle(self):
        peer = self.client_address[0]
        self.request.settimeout(CONNECTION_TIMEOUT_SECONDS)
        buffer = ''
        while True:
            try:
                data = self.request.recv(4096)
            except socket.timeout:
                break
            if not data:
                break
            buffer += data.decode('utf-8', errors='replace')
            if len(buffer) > MAX_BUFFER_CHARS:
                self.server.log(f'[{peer}] más de {MAX_BUFFER_CHARS} caracteres sin un JSON completo: cierro la conexión')
                break
            payloads, buffer = extract_json_payloads(buffer)
            for payload in payloads:
                self.server.process(payload, peer)


class TelemetryServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address, log):
        super().__init__(address, TelemetryHandler)
        self.log = log

    def process(self, payload, peer):
        close_old_connections()
        try:
            parsed = json.loads(payload)
            items = parsed if isinstance(parsed, list) else [parsed]
            if not all(key_ok(item) for item in items):
                self.log(f'[{peer}] descartada: falta KEY o no coincide con TELEMETRY_API_KEY')
                return
            for result in ingest_payload(items):
                if result.ok:
                    alerts = f', alertas nuevas {result.alerts_created}' if result.alerts_created else ''
                    self.log(f'[{peer}] lectura {result.reading_id} collar {result.device_id}{alerts}')
                else:
                    self.log(f'[{peer}] descartada: {result.error} <- {for_log(items)}')
        except json.JSONDecodeError:
            self.log(f'[{peer}] JSON inválido ({len(payload)} caracteres)')
        except Exception as error:  # keep the listener alive
            self.log(f'[{peer}] error procesando la lectura: {error}')
        finally:
            close_old_connections()


class Command(BaseCommand):
    help = 'Escucha por TCP los JSON que manda la Raspberry Pi (lora_receiver.c) y los guarda.'

    def add_arguments(self, parser):
        parser.add_argument('--port', type=int, default=settings.TELEMETRY_TCP_PORT)

    def _check_no_signal_forever(self):
        while True:
            time.sleep(NO_SIGNAL_CHECK_SECONDS)
            close_old_connections()
            try:
                created = alert_service.check_no_signal()
                if created:
                    self._log(f'alertas "sin señal" nuevas: {created}')
            except Exception as error:
                self._log(f'error revisando collares sin señal: {error}')
            finally:
                close_old_connections()

    def _log(self, message):
        self.stdout.write(message)
        self.stdout.flush()

    def handle(self, *args, **options):
        threading.Thread(target=self._check_no_signal_forever, daemon=True).start()
        with TelemetryServer(('0.0.0.0', options['port']), self._log) as server:
            self._log(f"Escuchando telemetría TCP en el puerto {options['port']}")
            if not settings.TELEMETRY_API_KEY:
                self._log('ATENCIÓN: TELEMETRY_API_KEY vacía, se acepta telemetría de cualquiera en la red.')
            server.serve_forever()
