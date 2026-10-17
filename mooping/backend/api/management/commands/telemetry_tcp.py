import json
import socketserver
import threading
import time

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from api.services import alert_service
from api.traffic.telemetry_views import ingest_payload

NO_SIGNAL_CHECK_SECONDS = 60


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
        buffer = ''
        while True:
            data = self.request.recv(4096)
            if not data:
                break
            buffer += data.decode('utf-8', errors='replace')
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
            for result in ingest_payload(json.loads(payload)):
                if result.ok:
                    alerts = f', alertas nuevas {result.alerts_created}' if result.alerts_created else ''
                    self.log(f'[{peer}] lectura {result.reading_id} collar {result.device_id}{alerts}')
                else:
                    self.log(f'[{peer}] descartada: {result.error} <- {payload}')
        except json.JSONDecodeError:
            self.log(f'[{peer}] JSON inválido: {payload}')
        except Exception as error:  # keep the listener alive
            self.log(f'[{peer}] error procesando {payload}: {error}')
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
            server.serve_forever()
