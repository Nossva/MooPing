#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import hashlib
import os
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
VENV_DIR = BASE_DIR / '.venv'
REQUIREMENTS = BASE_DIR / 'requirements.txt'
REQUIREMENTS_STAMP = VENV_DIR / '.requirements.sha256'


def venv_python():
    if os.name == 'nt':
        return VENV_DIR / 'Scripts' / 'python.exe'
    return VENV_DIR / 'bin' / 'python'


def ensure_venv():
    """First run: create .venv and install requirements, then re-run this
    command with the venv's Python. Skipped inside Docker (MOOPING_SKIP_VENV)
    and when already running from the venv."""
    if os.environ.get('MOOPING_SKIP_VENV'):
        return
    if Path(sys.prefix).resolve() == VENV_DIR.resolve():
        return

    python = venv_python()
    if not python.exists():
        if sys.version_info < (3, 12):
            sys.exit('MooPing needs Python 3.12 or newer (Django 6). '
                     f'Found {sys.version.split()[0]}.')
        print('Creating .venv ...')
        subprocess.check_call([sys.executable, '-m', 'venv', str(VENV_DIR)])

    wanted = hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()
    installed = REQUIREMENTS_STAMP.read_text().strip() if REQUIREMENTS_STAMP.exists() else ''
    if wanted != installed:
        print('Installing requirements.txt into .venv ...')
        subprocess.check_call([str(python), '-m', 'pip', 'install', '-q', '-r', str(REQUIREMENTS)])
        REQUIREMENTS_STAMP.write_text(wanted)

    sys.exit(subprocess.call([str(python), *sys.argv]))


def main():
    """Run administrative tasks."""
    ensure_venv()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
