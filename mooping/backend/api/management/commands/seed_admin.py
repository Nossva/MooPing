from django.core.management.base import BaseCommand, CommandError

from api.services import seed_service
from api.services.errors import ServiceError


class Command(BaseCommand):
    help = 'Crea un establecimiento vacío con un único usuario dueño (lo usa start3.py).'

    def add_arguments(self, parser):
        parser.add_argument('--email', default='admin@mooping.app')
        parser.add_argument('--password', default='mooping123')
        parser.add_argument('--name', default='Administrador')
        parser.add_argument('--org', default='Mi establecimiento', help='Nombre del establecimiento.')

    def handle(self, *args, **options):
        try:
            result = seed_service.seed_admin(options['org'], options['name'], options['email'], options['password'])
        except ServiceError as error:
            raise CommandError(error.message)
        self.stdout.write(self.style.SUCCESS(f"Establecimiento \"{result['organization']}\" creado, sin datos."))
        self.stdout.write(f"Login: {result['login']['email']} / {result['login']['password']}")
