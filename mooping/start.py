"""Levanta MooPing (base + backend + frontend) y abre la app en el navegador.

    python start.py

Solo necesita Docker Desktop abierto. Equivale a `docker compose up -d --build`,
aplicar los db/upgrade-*.sql a la base y esperar a que respondan la API y el frontend.
"""
import os
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TIMEOUT_S = 300


def read_env_file():
    """Values from mooping/.env (same file docker compose reads for the ports)."""
    env_file = ROOT / '.env'
    values = {}
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"\'')
    return values


ENV = read_env_file()
PORT = os.environ.get('BACKEND_PORT') or ENV.get('BACKEND_PORT', '8000')
URL = f'http://localhost:{PORT}/api/health/'
FRONTEND_PORT = os.environ.get('FRONTEND_PORT') or ENV.get('FRONTEND_PORT', '5173')
FRONTEND_URL = f'http://localhost:{FRONTEND_PORT}/'


def check_docker():
    try:
        result = subprocess.run(['docker', 'info'], capture_output=True)
    except FileNotFoundError:
        sys.exit('No encontré Docker. Instalá Docker Desktop: https://www.docker.com/products/docker-desktop/')
    if result.returncode != 0:
        sys.exit('Docker no está corriendo. Abrí Docker Desktop, esperá a que arranque y volvé a intentar.')


def compose_up():
    print('Levantando base, backend y frontend (la primera vez tarda unos minutos)...')
    if subprocess.call(['docker', 'compose', 'up', '-d', '--build'], cwd=ROOT) != 0:
        sys.exit('Falló `docker compose up`. Revisá el error de arriba.')


def apply_db_upgrades():
    """Runs every db/upgrade-*.sql on the existing database. schema.sql only
    runs on an empty volume, so schema changes reach old databases this way.
    The scripts are idempotent: running them on every start is safe."""
    psql = ['docker', 'compose', 'exec', '-T', 'db']
    deadline = time.monotonic() + TIMEOUT_S
    while subprocess.call(psql + ['pg_isready', '-U', 'mooping', '-d', 'mooping'], cwd=ROOT,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
        if time.monotonic() > deadline:
            sys.exit('La base no respondió. Revisá `docker compose logs db`.')
        time.sleep(2)

    for script in sorted(ROOT.glob('db/upgrade-*.sql')):
        print(f'Actualizando base: {script.name}')
        with script.open('rb') as sql:
            result = subprocess.run(
                psql + ['psql', '-U', 'mooping', '-d', 'mooping', '-q', '-v', 'ON_ERROR_STOP=1'],
                cwd=ROOT, stdin=sql, capture_output=True, text=True,
            )
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            sys.exit(f'Falló {script.name}. Revisá el error de arriba.')


def wait_for_api():
    """Polls /api/health/ until it answers with the database ok."""
    print(f'Esperando a que responda {URL} ...')
    deadline = time.monotonic() + TIMEOUT_S
    last_body = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(URL, timeout=3) as response:
                last_body = response.read().decode('utf-8', 'replace')
                if '"database":"ok"' in last_body.replace(' ', ''):
                    return
        except OSError:
            pass  # backend still starting (or restarting after a failed migrate)
        time.sleep(2)

    print(f'\nLa API no respondió bien en {TIMEOUT_S} s.', file=sys.stderr)
    if last_body:
        print(f'Última respuesta: {last_body}', file=sys.stderr)
    print('Últimas líneas del backend:\n', file=sys.stderr)
    subprocess.call(['docker', 'compose', 'logs', '--tail', '40', 'backend'], cwd=ROOT)
    sys.exit(1)


def wait_for_frontend():
    """Polls the Vite server; the first start runs `npm ci` inside the container."""
    print(f'Esperando a que responda {FRONTEND_URL} ...')
    deadline = time.monotonic() + TIMEOUT_S
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(FRONTEND_URL, timeout=3) as response:
                if response.status == 200:
                    return
        except OSError:
            pass  # npm ci / vite still starting
        time.sleep(2)

    print(f'\nEl frontend no respondió en {TIMEOUT_S} s.', file=sys.stderr)
    print('Últimas líneas del frontend:\n', file=sys.stderr)
    subprocess.call(['docker', 'compose', 'logs', '--tail', '40', 'frontend'], cwd=ROOT)
    sys.exit(1)


def main():
    check_docker()
    compose_up()
    apply_db_upgrades()
    wait_for_api()
    wait_for_frontend()
    print(f'\nMooPing está andando: {FRONTEND_URL}  (API: {URL})')
    print('Entrá con demo@mooping.app / mooping123.'
          ' Si no hay datos: docker compose exec backend python manage.py seed_demo')
    print('Logs: docker compose logs -f backend frontend   |   Apagar: docker compose down')
    webbrowser.open(FRONTEND_URL)


if __name__ == '__main__':
    main()
