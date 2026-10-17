from django.db import models


class Device(models.Model):
    """AgroNeck collar."""
    organization = models.ForeignKey('api.Organization', on_delete=models.SET_NULL, null=True)
    device_uid = models.TextField(unique=True)
    label = models.TextField(null=True)
    hardware_version = models.TextField(null=True)
    firmware_version = models.TextField(null=True)
    battery_model = models.TextField(null=True)
    tx_interval_s = models.IntegerField(default=60)
    storage_location = models.TextField(null=True)
    battery_pct = models.FloatField(null=True)
    last_rssi_dbm = models.SmallIntegerField(null=True)
    last_seen_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'devices'


class DeviceCommand(models.Model):
    device = models.ForeignKey('api.Device', on_delete=models.CASCADE)
    command = models.TextField()
    payload = models.JSONField(default=dict)
    status = models.TextField(default='queued')
    created_by = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True,
                                   db_column='created_by', related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'device_commands'


class MaintenanceTask(models.Model):
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    device = models.ForeignKey('api.Device', on_delete=models.CASCADE, null=True)
    gateway = models.ForeignKey('api.Gateway', on_delete=models.CASCADE, null=True)
    kind = models.TextField(default='battery_replacement')
    scheduled_for = models.DateField()
    notes = models.TextField(null=True)
    status = models.TextField(default='scheduled')
    created_by = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True,
                                   db_column='created_by', related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'maintenance_tasks'
