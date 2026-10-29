from django.db import models


class Organization(models.Model):
    name = models.TextField()
    vet_phone = models.TextField(null=True)
    fever_threshold_c = models.FloatField(default=39.2)
    no_signal_minutes = models.IntegerField(default=30)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'organizations'
