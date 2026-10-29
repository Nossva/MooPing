from django.db import models


class TelemetryReading(models.Model):
    """One reading from a collar. `location` (geography point) is handled with
    raw SQL in the repository."""
    device = models.ForeignKey('api.Device', on_delete=models.CASCADE)
    animal = models.ForeignKey('api.Animal', on_delete=models.SET_NULL, null=True)
    gateway = models.ForeignKey('api.Gateway', on_delete=models.SET_NULL, null=True)
    recorded_at = models.DateTimeField()
    altitude_m = models.FloatField(null=True)
    speed_mps = models.FloatField(null=True)
    heading_deg = models.FloatField(null=True)
    hdop = models.FloatField(null=True)
    satellites = models.SmallIntegerField(null=True)
    temp_body_c = models.FloatField(null=True)
    temp_ambient_c = models.FloatField(null=True)
    activity = models.FloatField(null=True)
    rumination_min = models.FloatField(null=True)

    class Meta:
        managed = False
        db_table = 'telemetry_readings'


class AnimalLastPosition(models.Model):
    """Maintained by the telemetry trigger; read-only from the backend."""
    animal = models.OneToOneField('api.Animal', on_delete=models.CASCADE, primary_key=True)
    device = models.ForeignKey('api.Device', on_delete=models.SET_NULL, null=True)
    recorded_at = models.DateTimeField()
    speed_mps = models.FloatField(null=True)
    heading_deg = models.FloatField(null=True)
    temp_body_c = models.FloatField(null=True)
    activity = models.FloatField(null=True)

    class Meta:
        managed = False
        db_table = 'animal_last_position'


class AnimalDailyStatistics(models.Model):
    pk = models.CompositePrimaryKey('animal_id', 'date')
    animal = models.ForeignKey('api.Animal', on_delete=models.CASCADE)
    date = models.DateField()
    distance_m = models.FloatField(default=0)
    movement_minutes = models.IntegerField(default=0)
    rest_minutes = models.IntegerField(default=0)
    temp_body_avg_c = models.FloatField(null=True)
    temp_body_max_c = models.FloatField(null=True)
    readings_count = models.IntegerField(default=0)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'animal_daily_statistics'
