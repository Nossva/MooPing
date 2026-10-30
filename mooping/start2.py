"""Igual que start.py, pero además carga los datos de demo para poder trabajar.

    python start2.py            # si la demo ya está cargada, la deja como está
    python start2.py --reset    # borra la demo y la vuelve a crear como nueva

Crea el establecimiento "El Ombú" (seed_demo) con los logins
demo@mooping.app (dueño) y maria@mooping.app (usuario), contraseña mooping123.
"""
import subprocess
import sys
import webbrowser

import start


def seed_demo(reset):
    print('Cargando datos de demo...')
    command = ['docker', 'compose', 'exec', '-T', 'backend', 'python', 'manage.py', 'seed_demo']
    if reset:
        command.append('--reset')
    result = subprocess.run(command, cwd=start.ROOT, capture_output=True, text=True)
    if result.returncode == 0:
        print(result.stdout.strip())
    elif 'Ya existe' in result.stderr:
        print('La demo ya estaba cargada (usá --reset para dejarla como nueva).')
    else:
        print(result.stdout + result.stderr, file=sys.stderr)
        sys.exit('Falló seed_demo. Revisá el error de arriba.')


def main():
    reset = '--reset' in sys.argv[1:]
    start.check_docker()
    start.compose_up()
    start.apply_db_upgrades()
    start.wait_for_api()
    seed_demo(reset)
    start.wait_for_frontend()
    print(f'\nMooPing está andando: {start.FRONTEND_URL}  (API: {start.URL})')
    print('Entrá con demo@mooping.app (dueño) o maria@mooping.app (usuario), contraseña mooping123.')
    print('Logs: docker compose logs -f backend frontend   |   Apagar: docker compose down')
    webbrowser.open(start.FRONTEND_URL)


if __name__ == '__main__':
    main()
