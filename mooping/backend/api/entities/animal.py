from django.db import models


class Animal(models.Model):
    organization = models.ForeignKey('api.Organization', on_delete=models.CASCADE)
    yard = models.ForeignKey('api.Yard', on_delete=models.SET_NULL, null=True)
    name = models.TextField()
    tag_number = models.TextField(null=True)
    lot = models.TextField(null=True)
    species = models.TextField(default='cattle')
    sex = models.TextField(null=True)
    breed = models.TextField(null=True)
    birth_date = models.DateField(null=True)
    photo_url = models.TextField(null=True)
    notes = models.TextField(null=True)
    status = models.TextField(default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'animals'


class AnimalDevice(models.Model):
    """Collar assignment history; unassigned_at IS NULL = active."""
    animal = models.ForeignKey('api.Animal', on_delete=models.CASCADE)
    device = models.ForeignKey('api.Device', on_delete=models.CASCADE)
    assigned_at = models.DateTimeField(auto_now_add=True)
    unassigned_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'animal_devices'
