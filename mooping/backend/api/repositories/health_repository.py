from django.db import connection


def ping_database():
    """Runs a trivial query; raises if the database is unreachable."""
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
