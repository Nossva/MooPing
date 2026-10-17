from django.db import models
from django.utils import timezone


class Alert(models.Model):
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    animal = models.ForeignKey('api.Animal', on_delete=models.CASCADE, null=True)
    device = models.ForeignKey('api.Device', on_delete=models.SET_NULL, null=True)
    yard = models.ForeignKey('api.Yard', on_delete=models.SET_NULL, null=True)
    type = models.TextField()
    severity = models.TextField(default='warning')
    status = models.TextField(default='pending')
    message = models.TextField(null=True)
    metadata = models.JSONField(default=dict)
    triggered_at = models.DateTimeField(default=timezone.now)
    assigned_to = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True,
                                    db_column='assigned_to', related_name='+')
    resolved_by = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True,
                                    db_column='resolved_by', related_name='+')
    resolved_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'alerts'


class AlertNote(models.Model):
    alert = models.ForeignKey('api.Alert', on_delete=models.CASCADE)
    user = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'alert_notes'
