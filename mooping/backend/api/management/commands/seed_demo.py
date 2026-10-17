from django.core.management.base import BaseCommand, CommandError

from api.services import seed_service
from api.services.errors import ServiceError


class Command(BaseCommand):
    help = 'Carga el establecimiento de demo "El Ombú" (usuarios, potreros, animales, collares y 7 días de lecturas).'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Borra y recrea el establecimiento de demo.')

    def handle(self, *args, **options):
        try:
            result = seed_service.seed(reset=options['reset'])
        except ServiceError as error:
            raise CommandError(error.message)
        self.stdout.write(self.style.SUCCESS(
            f"Demo lista: {result['animals']} animales, {result['collars']} collares, "
            f"{result['readings']} lecturas, {result['open_alerts']} alertas abiertas."
        ))
        self.stdout.write(f"Login: {result['login']['email']} / {result['login']['password']}")
