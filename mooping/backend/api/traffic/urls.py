from django.urls import path

from api.traffic import (
    alert_views,
    animal_views,
    auth_views,
    device_views,
    health_views,
    member_views,
    misc_views,
    status_views,
    support_views,
    telemetry_views,
    yard_views,
)

urlpatterns = [
    path('health/', health_views.health),

    # Session
    path('auth/login/', auth_views.login),
    path('auth/logout/', auth_views.logout),
    path('me/', auth_views.me),
    path('me/password/', auth_views.change_password),

    # Administración: establecimiento y usuarios
    path('organization/', member_views.organization_detail),
    path('organization/members/', member_views.member_list),
    path('organization/members/<int:user_id>/', member_views.member_detail),
    path('organization/members/<int:user_id>/password/', member_views.member_password),
    path('organization/members/<int:user_id>/access/', member_views.member_access),

    # Screen summaries
    path('status/', status_views.status),
    path('dashboard/summary/', status_views.dashboard_summary),
    path('monitoring/summary/', status_views.monitoring_summary),
    path('infrastructure/summary/', status_views.infrastructure_summary),

    # Alerts
    path('alerts/', alert_views.alert_list),
    path('alerts/summary/', alert_views.alert_summary),
    path('alerts/<int:alert_id>/', alert_views.alert_detail),
    path('alerts/<int:alert_id>/notes/', alert_views.alert_notes),

    # Potreros
    path('yards/', yard_views.yard_list),
    path('yards/<int:yard_id>/', yard_views.yard_detail),

    # Animals
    path('animals/', animal_views.animal_list),
    path('animals/positions/', animal_views.animal_positions),
    path('animals/<int:animal_id>/', animal_views.animal_detail),
    path('animals/<int:animal_id>/track/', animal_views.animal_track),
    path('animals/<int:animal_id>/alarm/', animal_views.animal_alarm),
    path('animals/<int:animal_id>/photo/', animal_views.animal_photo),
    path('media/animals/<str:name>', animal_views.animal_photo_file),

    # Collars
    path('devices/', device_views.device_list),
    path('devices/detected/', device_views.device_detected),
    path('devices/<int:device_id>/', device_views.device_detail),
    path('devices/<int:device_id>/assign/', device_views.device_assign),
    path('devices/<int:device_id>/unassign/', device_views.device_unassign),
    path('devices/<int:device_id>/ping/', device_views.device_ping),
    path('devices/<int:device_id>/maintenance/', device_views.device_maintenance),

    # Gateways, settings, store
    path('gateways/', misc_views.gateway_list),
    path('notification-settings/', misc_views.notification_settings),
    path('products/', misc_views.product_list),

    # Soporte técnico (every member)
    path('support/', support_views.support),
    path('support/requests/', support_views.support_requests),

    # Data from the Raspberry Pi
    path('telemetry/', telemetry_views.telemetry_ingest),
]
