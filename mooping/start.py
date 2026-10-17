"""Levanta MooPing (base + backend) y abre /api/health/ en el navegador.

    python start.py

Solo necesita Docker Desktop abierto. Equivale a `docker compose up -d --build`
más esperar a que la API responda.
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


PORT = os.environ.get('BACKEND_PORT') or read_env_file().get('BACKEND_PORT', '8000')
URL = f'http://localhost:{PORT}/api/health/'


def check_docker():
    try:
        result = subprocess.run(['docker', 'info'], capture_output=True)
    except FileNotFoundError:
        sys.exit('No encontré Docker. Instalá Docker Desktop: https://www.docker.com/products/docker-desktop/')
    if result.returncode != 0:
        sys.exit('Docker no está corriendo. Abrí Docker Desktop, esperá a que arranque y volvé a intentar.')


def compose_up():
    print('Levantando base y backend (la primera vez tarda unos minutos)...')
    if subprocess.call(['docker', 'compose', 'up', '-d', '--build'], cwd=ROOT) != 0:
        sys.exit('Falló `docker compose up`. Revisá el error de arriba.')


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


def main():
    check_docker()
    compose_up()
    wait_for_api()
    print(f'\nMooPing está andando: {URL}')
    print('Logs: docker compose logs -f backend   |   Apagar: docker compose down')
    webbrowser.open(URL)


if __name__ == '__main__':
    main()
