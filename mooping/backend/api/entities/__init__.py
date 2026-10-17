"""Entity layer: Django models mapped to the tables in mooping/db/schema.sql.

Every model uses ``managed = False``; schema.sql is the source of truth and
``migrate`` never touches these tables. Import each entity here so Django
registers it (api/models.py re-exports this package).
"""
