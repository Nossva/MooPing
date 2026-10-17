"""Entity layer: Django models mapped to the tables in mooping/db/schema.sql.

Every model uses ``managed = False``; schema.sql is the source of truth and
``migrate`` never touches these tables. Geography columns (yards.boundary,
telemetry/last-position location, gateways.location) are not mapped: the
repositories read and write them with PostGIS SQL.
"""
from .alert import CATEGORY_BY_TYPE, Alert, AlertNote
from .animal import Animal, AnimalDevice
from .device import Device, DeviceCommand, MaintenanceTask
from .gateway import Gateway
from .notification_settings import NotificationSettings
from .organization import Organization
from .telemetry import AnimalDailyStatistics, AnimalLastPosition, TelemetryReading
from .user import ApiToken, Membership, User
from .yard import Yard

__all__ = [
    'CATEGORY_BY_TYPE', 'Alert', 'AlertNote', 'Animal', 'AnimalDevice', 'Device',
    'DeviceCommand', 'MaintenanceTask', 'Gateway', 'NotificationSettings',
    'Organization', 'AnimalDailyStatistics', 'AnimalLastPosition',
    'TelemetryReading', 'ApiToken', 'Membership', 'User', 'Yard',
]
