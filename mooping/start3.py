"""Como start.py, pero deja la base en cero: borra la base anterior (y las fotos
de animales) y crea un establecimiento vacío con un solo usuario dueño.

    python start3.py                    # pide confirmación antes de borrar
    python start3.py --yes              # sin preguntar
    python start3.py --email yo@campo.com --password otra-clave --org "La Estancia"

Por defecto el login es admin@mooping.app / mooping123.
"""
import argparse
import json
import shutil
import subprocess
import sys
import webbrowser

import start

DB_VOLUME = 'mooping-data'  # volumen de la base en docker-compose.yml


def parse_args():
    parser = argparse.ArgumentParser(description='Levanta MooPing con la base vacía y un solo administrador.')
    parser.add_argument('--yes', action='store_true', help='No pedir confirmación antes de borrar la base.')
    parser.add_argument('--email', default='admin@mooping.app')
    parser.add_argument('--password', default='mooping123')
    parser.add_argument('--name', default='Administrador')
    parser.add_argument('--org', default='Mi establecimiento', help='Nombre del establecimiento.')
    return parser.parse_args()


def confirm():
    print('Esto BORRA la base de MooPing (usuarios, animales, potreros, collares, alertas,')
    print('telemetría) y las fotos de animales. No se puede deshacer.')
    if input('¿Seguir? (s/N): ').strip().lower() not in ('s', 'si', 'sí'):
        sys.exit('Cancelado, no se borró nada.')


def db_volume_name():
    """Compose prefixes volumes with the project name (the folder, unless overridden)."""
    result = subprocess.run(['docker', 'compose', 'config', '--format', 'json'], cwd=start.ROOT,
                            capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        sys.exit('Falló `docker compose config`. Revisá el error de arriba.')
    return f"{json.loads(result.stdout)['name']}_{DB_VOLUME}"


def wipe_database():
    """Stops what uses the database and deletes its volume; the next `up`
    recreates it from db/schema.sql. The frontend keeps its node_modules."""
    print('Borrando la base anterior...')
    subprocess.call(['docker', 'compose', 'stop', 'backend', 'telemetry', 'db'], cwd=start.ROOT)
    subprocess.call(['docker', 'compose', 'rm', '-f', 'db'], cwd=start.ROOT)
    volume = db_volume_name()
    exists = subprocess.run(['docker', 'volume', 'inspect', volume], capture_output=True).returncode == 0
    if exists and subprocess.call(['docker', 'volume', 'rm', volume], cwd=start.ROOT) != 0:
        sys.exit(f'No se pudo borrar el volumen {volume}. Revisá el error de arriba.')

    # Las fotos quedan en disco (MEDIA_ROOT, montado desde backend/media) y apuntaban a la base vieja.
    photos = start.ROOT / 'backend' / 'media' / 'animals'
    if photos.exists():
        shutil.rmtree(photos)


def seed_admin(args):
    print('Creando el usuario administrador...')
    command = ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'seed_admin',
               '--email', args.email, '--password', args.password, '--name', args.name, '--org', args.org]
    result = subprocess.run(command, cwd=start.ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout + result.stderr, file=sys.stderr)
        sys.exit('Falló seed_admin. Revisá el error de arriba.')
    print(result.stdout.strip())


def main():
    args = parse_args()
    start.check_docker()
    if not args.yes:
        confirm()
    wipe_database()
    start.compose_up()
    start.apply_db_upgrades()
    start.wait_for_api()
    seed_admin(args)
    start.wait_for_frontend()
    print(f'\nMooPing está andando con la base vacía: {start.FRONTEND_URL}  (API: {start.URL})')
    print(f'Entrá con {args.email} / {args.password} (dueño).')
    print('Logs: docker compose logs -f backend frontend   |   Apagar: docker compose down')
    webbrowser.open(start.FRONTEND_URL)


if __name__ == '__main__':
    main()
