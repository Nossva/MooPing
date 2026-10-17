from django.db import models


class Yard(models.Model):
    """Potrero. `boundary` (geography polygon) is handled with raw SQL in the
    repository."""
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    name = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'yards'
