from django.db import models


class NotificationSettings(models.Model):
    pk = models.CompositePrimaryKey('organization_id', 'user_id')
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    user = models.ForeignKey('api.User', on_delete=models.CASCADE)
    alarm_sound = models.BooleanField(default=True)
    notify_geofence = models.BooleanField(default=True)
    notify_health = models.BooleanField(default=True)
    notify_equipment = models.BooleanField(default=True)
    channel_push = models.BooleanField(default=True)
    channel_email = models.BooleanField(default=False)
    channel_sms = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'notification_settings'
