import codecs
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
# The timeout is for the whole connection, not per recv: a client dripping a
# byte every few seconds can't keep a thread forever.
CONNECTION_TIMEOUT_SECONDS = 30
MAX_BUFFER_CHARS = 64 * 1024
# One thread per connection: without a cap, thousands of idle connections from
# the internet exhaust threads/memory before any KEY is checked. The Pis are a
# handful of gateways, so these are far above what they need.
MAX_CONNECTIONS = 64
MAX_CONNECTIONS_PER_IP = 8
# While refusing connections, log at most once per this many seconds.
REFUSED_LOG_SECONDS = 60


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
        deadline = time.monotonic() + CONNECTION_TIMEOUT_SECONDS
        # Incremental: a multi-byte character split between two recv stays whole.
        decoder = codecs.getincrementaldecoder('utf-8')(errors='replace')
        buffer = ''
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            self.request.settimeout(remaining)
            try:
                data = self.request.recv(4096)
            except (socket.timeout, OSError):
                break
            if not data:
                break
            buffer += decoder.decode(data)
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
        self._lock = threading.Lock()
        self._open = 0
        self._open_by_ip = {}
        self._refused = 0
        self._refused_logged_at = 0.0

    def _acquire(self, ip):
        with self._lock:
            if self._open >= MAX_CONNECTIONS or self._open_by_ip.get(ip, 0) >= MAX_CONNECTIONS_PER_IP:
                self._refused += 1
                return False
            self._open += 1
            self._open_by_ip[ip] = self._open_by_ip.get(ip, 0) + 1
            return True

    def _release(self, ip):
        with self._lock:
            self._open -= 1
            left = self._open_by_ip[ip] - 1
            if left:
                self._open_by_ip[ip] = left
            else:
                del self._open_by_ip[ip]

    def _log_refused(self, ip):
        now = time.monotonic()
        with self._lock:
            if now - self._refused_logged_at < REFUSED_LOG_SECONDS:
                return
            refused, self._refused, self._refused_logged_at = self._refused, 0, now
        self.log(f'[{ip}] demasiadas conexiones abiertas: rechazadas {refused} '
                 f'(máx. {MAX_CONNECTIONS}, {MAX_CONNECTIONS_PER_IP} por IP)')

    def process_request(self, request, client_address):
        """Refuses the connection (closes it) instead of starting one more thread."""
        ip = client_address[0]
        if not self._acquire(ip):
            self.shutdown_request(request)
            self._log_refused(ip)
            return
        try:
            super().process_request(request, client_address)
        except Exception:  # the thread couldn't start
            self._release(ip)
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._release(client_address[0])

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
                    animal = f', animal {result.animal_id}' if result.animal_id else ', sin animal asignado'
                    position = '' if result.has_position else ', sin posición (GPS sin fix)'
                    alerts = f', alertas nuevas {result.alerts_created}' if result.alerts_created else ''
                    self.log(f'[{peer}] lectura {result.reading_id} collar {result.device_id}{animal}{position}{alerts}')
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
