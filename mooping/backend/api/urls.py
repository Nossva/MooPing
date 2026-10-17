from django.urls import path

from api.traffic import health_views

urlpatterns = [
    path('health/', health_views.health),
]
