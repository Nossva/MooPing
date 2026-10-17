"""Input validation for request bodies and query params. The validated data
becomes a request DTO (see api/dto and traffic/http.request_dto)."""
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class AlertListQuery(serializers.Serializer):
    status = serializers.ChoiceField(['open', 'all', 'pending', 'assigned', 'in_progress', 'resolved'],
                                     required=False)
    category = serializers.ChoiceField(['critical', 'sanitary', 'equipment'], required=False)
    since = serializers.ChoiceField(['today'], required=False)
    sort = serializers.ChoiceField(['urgency', 'recent'], default='urgency')
    animal_id = serializers.IntegerField(required=False)
    device_id = serializers.IntegerField(required=False)


class AlertUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(['pending', 'assigned', 'in_progress', 'resolved'], required=False)
    assigned_to = serializers.IntegerField(required=False)


class NoteSerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)


class YardSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    boundary = serializers.JSONField(help_text='GeoJSON Polygon (lng, lat)')


class YardQuery(serializers.Serializer):
    yard_id = serializers.IntegerField(required=False)


class PositionsQuery(serializers.Serializer):
    yard_id = serializers.IntegerField(required=False)
    geofence = serializers.ChoiceField(['inside', 'outside'], required=False)


class AnimalListQuery(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    yard_id = serializers.IntegerField(required=False)
    geofence = serializers.ChoiceField(['inside', 'outside'], required=False)
    status = serializers.ChoiceField(['active', 'inactive', 'sold', 'dead'], default='active')


class AnimalSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    tag_number = serializers.CharField(max_length=100, required=False, allow_null=True, allow_blank=True)
    lot = serializers.CharField(max_length=200, required=False, allow_null=True, allow_blank=True)
    species = serializers.CharField(max_length=50, required=False)
    sex = serializers.ChoiceField(['female', 'male'], required=False, allow_null=True)
    breed = serializers.CharField(max_length=200, required=False, allow_null=True, allow_blank=True)
    birth_date = serializers.DateField(required=False, allow_null=True)
    photo_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    status = serializers.ChoiceField(['active', 'inactive', 'sold', 'dead'], required=False)
    yard_id = serializers.IntegerField(required=False, allow_null=True)


class TrackQuery(serializers.Serializer):
    hours = serializers.IntegerField(default=24, min_value=1, max_value=720)


class DeviceListQuery(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    filter = serializers.ChoiceField(['low_battery', 'alert', 'stock', 'no_signal', 'needs_attention'],
                                     required=False)


class DevicePairSerializer(serializers.Serializer):
    device_uid = serializers.CharField(max_length=100)
    label = serializers.CharField(max_length=100, required=False)
    hardware_version = serializers.CharField(max_length=50, required=False)
    firmware_version = serializers.CharField(max_length=50, required=False)
    battery_model = serializers.CharField(max_length=100, required=False)
    storage_location = serializers.CharField(max_length=200, required=False)


class DeviceUpdateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=100, required=False)
    hardware_version = serializers.CharField(max_length=50, required=False)
    firmware_version = serializers.CharField(max_length=50, required=False)
    battery_model = serializers.CharField(max_length=100, required=False)
    tx_interval_s = serializers.IntegerField(required=False)
    storage_location = serializers.CharField(max_length=200, required=False, allow_null=True, allow_blank=True)


class AssignSerializer(serializers.Serializer):
    animal_id = serializers.IntegerField()


class UnassignSerializer(serializers.Serializer):
    storage_location = serializers.CharField(max_length=200, required=False)


class MaintenanceSerializer(serializers.Serializer):
    scheduled_for = serializers.DateField()
    kind = serializers.ChoiceField(['battery_replacement', 'repair', 'inspection'], default='battery_replacement')
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class NotificationSettingsSerializer(serializers.Serializer):
    alarm_sound = serializers.BooleanField(required=False)
    notify_geofence = serializers.BooleanField(required=False)
    notify_health = serializers.BooleanField(required=False)
    notify_equipment = serializers.BooleanField(required=False)
    channel_push = serializers.BooleanField(required=False)
    channel_email = serializers.BooleanField(required=False)
    channel_sms = serializers.BooleanField(required=False)
