"""`manage.py test` with the real schema.

The api models are managed = False, so `migrate` creates no tables in the test
database: this runner loads mooping/db/schema.sql (PostGIS, triggers) into it
right after Django creates it.
"""
from pathlib import Path

from django.conf import settings
from django.db import connections
from django.test.runner import DiscoverRunner

# Host: mooping/db/schema.sql. Docker: docker-compose.yml mounts ./db at /db
# (/app is the backend, so BASE_DIR.parent is /).
SCHEMA = Path(settings.BASE_DIR).parent / 'db' / 'schema.sql'


class SchemaTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        old_config = super().setup_databases(**kwargs)
        if not SCHEMA.exists():
            raise RuntimeError(f'No encuentro {SCHEMA}: en Docker hace falta montar ./db en /db.')
        for alias in connections:
            with connections[alias].cursor() as cursor:
                cursor.execute("SELECT to_regclass('public.organizations')")
                if cursor.fetchone()[0] is None:  # --keepdb: already loaded
                    cursor.execute(SCHEMA.read_text(encoding='utf-8'))
        return old_config
