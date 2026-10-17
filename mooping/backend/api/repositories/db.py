"""Small helpers for raw SQL (PostGIS queries the ORM cannot express)."""
from django.db import connection

from api.repositories.records import from_row


def fetch_all(sql, params=None, record=None):
    """Rows as dicts, or as `record` dataclasses when given."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        columns = [col.name for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return [from_row(record, r) for r in rows] if record else rows


def fetch_one(sql, params=None, record=None):
    rows = fetch_all(sql, params, record)
    return rows[0] if rows else None


def fetch_value(sql, params=None):
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        row = cursor.fetchone()
        return row[0] if row else None


def execute(sql, params=None):
    """Runs a statement; returns the first column of the first row if the
    statement has RETURNING, else the affected row count."""
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        if cursor.description:
            row = cursor.fetchone()
            return row[0] if row else None
        return cursor.rowcount
