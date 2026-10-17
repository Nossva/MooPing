from django.db import models


class Gateway(models.Model):
    """Pi receiving station or LoRa repeater. `location` (geography) is
    handled with raw SQL in the repository."""
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    gateway_uid = models.TextField(unique=True)
    name = models.TextField(null=True)
    kind = models.TextField(default='gateway')
    power_source = models.TextField(null=True)
    battery_pct = models.FloatField(null=True)
    radio = models.TextField(null=True)
    coverage_ha = models.FloatField(null=True)
    api_key_hash = models.TextField(null=True)
    last_seen_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'gateways'
