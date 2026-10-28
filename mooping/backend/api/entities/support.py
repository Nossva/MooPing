from django.core.serializers.json import DjangoJSONEncoder
from django.db import models


class SupportRequest(models.Model):
    """Reclamo sent from the Soporte screen (also emailed to SUPPORT_EMAIL)."""
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    user = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True)
    category = models.TextField(default='other')  # collar | gateway | app | other
    message = models.TextField()
    diagnostic = models.JSONField(encoder=DjangoJSONEncoder)  # datetimes inside
    user_agent = models.TextField(null=True)
    email_sent_at = models.DateTimeField(null=True)
    email_error = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'support_requests'
