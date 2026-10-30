"""Backend tests. They run against PostgreSQL + PostGIS with db/schema.sql
loaded by config/test_runner.py:

    docker compose run --rm backend python manage.py test
"""
import math
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.dto.request.base import DtoValidationError
from api.dto.request.telemetry_request import TelemetryReadingRequest
from api.entities import Alert, Animal, Device, Organization, collar_uid, default_collar_label, device_state
from api.repositories import device_repository, user_repository, yard_repository
from api.services import alert_service

PASSWORD = 'pasto-verde-2026'

# Potrero de ~2 km x 2 km alrededor de (-58.24, -34.70), en GeoJSON (lng, lat).
BOUNDARY = {
    'type': 'Polygon',
    'coordinates': [[[-58.25, -34.71], [-58.23, -34.71], [-58.23, -34.69], [-58.25, -34.69], [-58.25, -34.71]]],
}
INSIDE = (-58.24, -34.70)
OUTSIDE = (-58.20, -34.70)


# ---------------------------------------------------------------- pure rules

class CollarUidTests(SimpleTestCase):
    def test_accepts_every_spelling_of_the_number(self):
        for raw in ('84', '084', 'C-084', 'c84', 'collar 84', 'COLLAR-84', ' Collar_084 '):
            self.assertEqual(collar_uid(raw), 'COLLAR-84', raw)

    def test_rejects_what_is_not_a_collar_number(self):
        for raw in ('', None, 'vaca 3', '65536', 'COLLAR-'):
            self.assertIsNone(collar_uid(raw), raw)

    def test_default_label(self):
        self.assertEqual(default_collar_label('COLLAR-84'), 'C-084')
        self.assertEqual(default_collar_label('OTRO'), 'OTRO')


class DeviceStateTests(SimpleTestCase):
    def test_states_in_priority_order(self):
        self.assertEqual(device_state(False, True, True), 'stock')
        self.assertEqual(device_state(True, True, True), 'no_signal')
        self.assertEqual(device_state(True, False, True), 'alert')
        self.assertEqual(device_state(True, False, False), 'optimal')


class TelemetryPayloadTests(SimpleTestCase):
    def test_payload_from_the_pi(self):
        r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'LAT': -34.7, 'LONG': -58.24, 'TEMP': '38.40'})
        self.assertEqual(r.device_uid, 'COLLAR-3')
        self.assertEqual((r.lat, r.lng, r.temp_body_c), (-34.7, -58.24, 38.4))
        self.assertLess(abs((timezone.now() - r.recorded_at).total_seconds()), 5)

    def test_missing_id_is_rejected(self):
        with self.assertRaises(DtoValidationError):
            TelemetryReadingRequest.from_payload({'LAT': -34.7, 'LONG': -58.24})

    def test_non_numeric_value_is_rejected(self):
        with self.assertRaises(DtoValidationError):
            TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'TEMP': 'caliente'})

    def test_coordinates_out_of_range_are_rejected(self):
        with self.assertRaises(DtoValidationError):
            TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'LAT': -134.7, 'LONG': -58.24})

    def test_gps_without_fix_keeps_the_rest_of_the_reading(self):
        for lat, lng in ((0, 0), (math.nan, math.nan)):
            r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'LAT': lat, 'LONG': lng, 'TEMP': 38.5})
            self.assertIsNone(r.lat)
            self.assertIsNone(r.lng)
            self.assertEqual(r.temp_body_c, 38.5)

    def test_sensor_glitches_are_dropped(self):
        for temp in (85, 127, -5, math.inf):
            r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'TEMP': temp})
            self.assertIsNone(r.temp_body_c, temp)

    def test_timestamp_in_seconds_or_milliseconds(self):
        when = timezone.now().replace(microsecond=0) - timedelta(hours=1)
        for ts in (when.timestamp(), when.timestamp() * 1000, str(int(when.timestamp()))):
            r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'TS': ts})
            self.assertEqual(r.recorded_at, when, ts)

    def test_clock_far_off_gets_the_arrival_time(self):
        for ts in (0, (timezone.now() + timedelta(days=2)).isoformat()):
            r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'TS': ts})
            self.assertLess(abs((timezone.now() - r.recorded_at).total_seconds()), 5, ts)

    def test_invalid_timestamp_is_rejected(self):
        with self.assertRaises(DtoValidationError):
            TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3', 'TS': 'ayer'})

    def test_gateway_from_header_when_not_in_payload(self):
        r = TelemetryReadingRequest.from_payload({'ID': 'COLLAR-3'}, gateway_uid='AGROBOT-01')
        self.assertEqual(r.gateway_uid, 'AGROBOT-01')


# ---------------------------------------------------------------- with the database

# MD5 only to keep the tests fast; production uses Django's default hashers.
@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'], TELEMETRY_API_KEY='')
class ApiTestCase(TestCase):
    """An establecimiento with an owner, a potrero and an animal wearing collar 1."""

    def setUp(self):
        cache.clear()  # login throttling
        self.org = Organization.objects.create(name='La Esperanza')
        self.owner = self.make_member('Ana Dueña', 'ana@example.com', 'owner')
        self.yard_id = yard_repository.create(self.org.id, 'Potrero Norte', BOUNDARY)
        self.animal = Animal.objects.create(organization_id=self.org.id, yard_id=self.yard_id, name='Vaca #084')
        self.device = device_repository.create('COLLAR-1', organization_id=self.org.id, label='C-001')
        device_repository.assign(self.device.id, self.animal.id)

    def make_member(self, name, email, role='user', org=None):
        user = user_repository.create(name, email, make_password(PASSWORD))
        user_repository.add_membership((org or self.org).id, user.id, role)
        return user

    def client_for(self, user):
        client = APIClient(HTTP_X_REQUESTED_WITH='XMLHttpRequest')
        response = client.post('/api/auth/login/', {'email': user.email, 'password': PASSWORD}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        return client

    def reading(self, lng_lat=INSIDE, temp=38.5, uid='COLLAR-1', **extra):
        payload = {'ID': uid, 'LONG': lng_lat[0], 'LAT': lng_lat[1], 'TEMP': temp, **extra}
        return APIClient().post('/api/telemetry/', payload, format='json')

    def open_alerts(self, type_):
        return Alert.objects.filter(organization_id=self.org.id, type=type_).exclude(status='resolved')


class AuthTests(ApiTestCase):
    def test_login_sets_an_httponly_cookie(self):
        response = APIClient().post('/api/auth/login/', {'email': 'ANA@example.com', 'password': PASSWORD},
                                    format='json')
        self.assertEqual(response.status_code, 200)
        cookie = response.cookies['mooping_session']
        self.assertTrue(cookie['httponly'])
        self.assertNotIn('token', response.json())
        self.assertEqual(response.json()['organizations'][0]['role'], 'owner')

    def test_wrong_password(self):
        response = APIClient().post('/api/auth/login/', {'email': 'ana@example.com', 'password': 'otra-cosa-123'},
                                    format='json')
        self.assertEqual(response.status_code, 401)

    def test_unknown_email_gets_the_same_answer(self):
        response = APIClient().post('/api/auth/login/', {'email': 'nadie@example.com', 'password': PASSWORD},
                                    format='json')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['detail'], 'Email o contraseña incorrectos.')

    def test_me_requires_a_session(self):
        self.assertEqual(APIClient().get('/api/me/').status_code, 401)
        self.assertEqual(self.client_for(self.owner).get('/api/me/').json()['user']['email'], 'ana@example.com')

    def test_writes_need_the_csrf_header(self):
        client = self.client_for(self.owner)
        response = client.post('/api/yards/', {'name': 'Sur', 'boundary': BOUNDARY}, format='json',
                               HTTP_X_REQUESTED_WITH='')
        self.assertEqual(response.status_code, 403)

    def test_logout_ends_the_session(self):
        client = self.client_for(self.owner)
        self.assertEqual(client.post('/api/auth/logout/').status_code, 204)
        self.assertEqual(client.get('/api/me/').status_code, 401)

    def test_suspended_member_cannot_enter(self):
        user = self.make_member('Beto', 'beto@example.com')
        user_repository.update_member(self.org.id, user.id, active=False)
        response = self.client_for(user).get('/api/alerts/')
        self.assertEqual(response.status_code, 403)

    def test_change_password_closes_the_other_sessions(self):
        first, second = self.client_for(self.owner), self.client_for(self.owner)
        response = first.post('/api/me/password/', {'current_password': PASSWORD, 'new_password': 'tranquera-azul-77'},
                              format='json')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(first.get('/api/me/').status_code, 200)
        self.assertEqual(second.get('/api/me/').status_code, 401)

    def test_login_is_throttled(self):
        # LOGIN_RATE default: 10/min per IP.
        client = APIClient()
        codes = [client.post('/api/auth/login/', {'email': 'ana@example.com', 'password': 'mal'}, format='json')
                 .status_code for _ in range(11)]
        self.assertEqual(codes[:10], [401] * 10)
        self.assertEqual(codes[10], 429)


class TelemetryTests(ApiTestCase):
    def test_reading_inside_the_potrero_opens_nothing(self):
        response = self.reading(INSIDE)
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body['animal_id'], self.animal.id)
        self.assertEqual(body['alerts_created'], [])
        self.device.refresh_from_db()
        self.assertIsNotNone(self.device.last_seen_at)

    def test_leaving_and_coming_back(self):
        self.reading(OUTSIDE)
        alert = self.open_alerts('geofence_exit').get()
        self.assertEqual(alert.severity, 'critical')
        self.assertGreater(alert.metadata['distance_m'], 1000)

        self.reading(OUTSIDE)  # still outside: same alert, not a new one
        self.assertEqual(self.open_alerts('geofence_exit').count(), 1)

        self.reading(INSIDE)
        alert.refresh_from_db()
        self.assertEqual(alert.status, 'resolved')
        self.assertEqual(alert.metadata['resolution'], 'back_inside')

    def test_fever_keeps_the_peak(self):
        self.reading(temp=39.5)
        self.reading(temp=40.1)
        self.reading(temp=39.6)
        alert = self.open_alerts('fever').get()
        self.assertEqual(alert.metadata['temp_c'], 40.1)

    def test_unknown_collar_is_registered_without_owner(self):
        response = self.reading(uid='collar-084')
        self.assertEqual(response.status_code, 201)
        device = Device.objects.get(device_uid='COLLAR-84')
        self.assertIsNone(device.organization_id)
        self.assertIsNone(response.json()['animal_id'])

    def test_batch_with_one_bad_reading(self):
        response = APIClient().post('/api/telemetry/', [{'ID': 'COLLAR-1', 'TEMP': 38.4}, {'TEMP': 38.4}],
                                    format='json')
        self.assertEqual(response.status_code, 207)
        self.assertEqual([r['ok'] for r in response.json()], [True, False])

    @override_settings(TELEMETRY_API_KEY='secreto')
    def test_api_key_when_configured(self):
        self.assertEqual(self.reading().status_code, 401)
        response = APIClient().post('/api/telemetry/', {'ID': 'COLLAR-1'}, format='json', HTTP_X_API_KEY='secreto')
        self.assertEqual(response.status_code, 201)

    def test_reading_closes_no_signal(self):
        # Silence counts from the last reading or the assignment, whichever is later.
        two_hours_ago = timezone.now() - timedelta(hours=2)
        device_repository.backdate_assignments(self.org.id, two_hours_ago)
        Device.objects.filter(id=self.device.id).update(last_seen_at=two_hours_ago)
        alert_service.check_no_signal()
        self.assertEqual(self.open_alerts('no_signal').count(), 1)
        self.reading()
        self.assertEqual(self.open_alerts('no_signal').count(), 0)


class GeofenceRecheckTests(ApiTestCase):
    def test_moving_the_boundary_reevaluates_the_last_position(self):
        self.reading(INSIDE)
        client = self.client_for(self.owner)
        far = {'type': 'Polygon', 'coordinates': [[[-58.10, -34.71], [-58.08, -34.71], [-58.08, -34.69],
                                                   [-58.10, -34.69], [-58.10, -34.71]]]}
        response = client.patch(f'/api/yards/{self.yard_id}/', {'boundary': far}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.open_alerts('geofence_exit').count(), 1)

        client.patch(f'/api/yards/{self.yard_id}/', {'boundary': BOUNDARY}, format='json')
        self.assertEqual(self.open_alerts('geofence_exit').count(), 0)


class YardTests(ApiTestCase):
    def test_self_crossing_boundary_is_rejected(self):
        bowtie = {'type': 'Polygon', 'coordinates': [[[-58.25, -34.71], [-58.23, -34.69], [-58.23, -34.71],
                                                      [-58.25, -34.69], [-58.25, -34.71]]]}
        response = self.client_for(self.owner).post('/api/yards/', {'name': 'Moño', 'boundary': bowtie}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_open_ring_is_rejected(self):
        ring = BOUNDARY['coordinates'][0][:-1]
        response = self.client_for(self.owner).post(
            '/api/yards/', {'name': 'Abierto', 'boundary': {'type': 'Polygon', 'coordinates': [ring]}}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_duplicate_name(self):
        response = self.client_for(self.owner).post('/api/yards/', {'name': 'Potrero Norte', 'boundary': BOUNDARY},
                                                    format='json')
        self.assertEqual(response.status_code, 409)

    def test_area_in_hectares(self):
        yards = self.client_for(self.owner).get('/api/yards/').json()
        self.assertAlmostEqual(yards[0]['area_ha'], 400, delta=60)  # ~1.8 km x 2.2 km


class AlertTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.reading(OUTSIDE)
        self.alert = self.open_alerts('geofence_exit').get()
        self.user = self.make_member('Beto Peón', 'beto@example.com')

    def test_list_and_summary(self):
        client = self.client_for(self.user)
        alerts = client.get('/api/alerts/').json()
        self.assertEqual([a['id'] for a in alerts], [self.alert.id])
        self.assertEqual(alerts[0]['category'], 'critical')
        summary = client.get('/api/alerts/summary/').json()
        self.assertEqual(summary['open_total'], 1)
        self.assertEqual(summary['critical_unattended'], 1)

    def test_member_takes_and_resolves_an_alert(self):
        client = self.client_for(self.user)
        url = f'/api/alerts/{self.alert.id}/'
        body = client.patch(url, {'assigned_to': self.user.id}, format='json').json()
        self.assertEqual(body['status'], 'assigned')
        body = client.patch(url, {'status': 'resolved'}, format='json').json()
        self.assertEqual(body['status'], 'resolved')
        self.assertEqual(body['resolved_by']['id'], self.user.id)

    def test_only_the_owner_assigns_to_someone_else(self):
        other = self.make_member('Caro', 'caro@example.com')
        url = f'/api/alerts/{self.alert.id}/'
        response = self.client_for(self.user).patch(url, {'assigned_to': other.id}, format='json')
        self.assertEqual(response.status_code, 403)
        response = self.client_for(self.owner).patch(url, {'assigned_to': other.id}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_cannot_assign_to_someone_who_cannot_see_it(self):
        blind = self.make_member('Dani', 'dani@example.com')
        user_repository.set_access(self.org.id, blind.id, ['inicio'], True, [], [])
        response = self.client_for(self.owner).patch(f'/api/alerts/{self.alert.id}/', {'assigned_to': blind.id},
                                                     format='json')
        self.assertEqual(response.status_code, 400)

    def test_notes(self):
        client = self.client_for(self.user)
        url = f'/api/alerts/{self.alert.id}/notes/'
        self.assertEqual(client.post(url, {'body': '   '}, format='json').status_code, 400)
        self.assertEqual(client.post(url, {'body': 'Voy en la camioneta'}, format='json').status_code, 201)
        self.assertEqual([n['body'] for n in client.get(url).json()], ['Voy en la camioneta'])

    def test_other_establecimiento_does_not_see_it(self):
        other_org = Organization.objects.create(name='El Ombú')
        stranger = self.make_member('Eva', 'eva@example.com', 'owner', org=other_org)
        client = self.client_for(stranger)
        self.assertEqual(client.get('/api/alerts/').json(), [])
        self.assertEqual(client.get(f'/api/alerts/{self.alert.id}/').status_code, 404)


class AccessTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.make_member('Beto Peón', 'beto@example.com')
        south = {'type': 'Polygon', 'coordinates': [[[-58.25, -34.80], [-58.23, -34.80], [-58.23, -34.78],
                                                     [-58.25, -34.78], [-58.25, -34.80]]]}
        self.south_id = yard_repository.create(self.org.id, 'Potrero Sur', south)
        self.south_animal = Animal.objects.create(organization_id=self.org.id, yard_id=self.south_id, name='Vaca #200')

    def test_user_cannot_write_owner_only_endpoints(self):
        client = self.client_for(self.user)
        self.assertEqual(client.post('/api/yards/', {'name': 'X', 'boundary': BOUNDARY}, format='json').status_code,
                         403)
        self.assertEqual(client.patch('/api/organization/', {'name': 'Mía'}, format='json').status_code, 403)

    def test_sections(self):
        user_repository.set_access(self.org.id, self.user.id, ['inicio', 'alertas'], True, [], [])
        client = self.client_for(self.user)
        self.assertEqual(client.get('/api/alerts/').status_code, 200)
        self.assertEqual(client.get('/api/animals/').status_code, 403)
        self.assertEqual(client.get('/api/devices/').status_code, 403)
        sections = client.get('/api/me/').json()['organizations'][0]['sections']
        self.assertEqual(sections, ['inicio', 'alertas'])

    def test_potreros(self):
        user_repository.set_access(self.org.id, self.user.id, None, False, [self.south_id], [])
        client = self.client_for(self.user)
        self.assertEqual([a['id'] for a in client.get('/api/animals/').json()], [self.south_animal.id])
        self.assertEqual(client.get(f'/api/animals/{self.animal.id}/').status_code, 404)
        self.assertEqual([y['id'] for y in client.get('/api/yards/').json()], [self.south_id])

    def test_loose_animal(self):
        user_repository.set_access(self.org.id, self.user.id, None, False, [], [self.animal.id])
        self.reading(OUTSIDE)
        client = self.client_for(self.user)
        self.assertEqual([a['id'] for a in client.get('/api/animals/').json()], [self.animal.id])
        self.assertEqual(len(client.get('/api/alerts/').json()), 1)

    def test_owner_sets_access(self):
        url = f'/api/organization/members/{self.user.id}/access/'
        client = self.client_for(self.owner)
        body = {'sections': ['alertas'], 'all_yards': False, 'yard_ids': [self.south_id]}
        response = client.put(url, body, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['access']['yard_ids'], [self.south_id])

        self.assertEqual(client.put(url, {**body, 'sections': ['cocina']}, format='json').status_code, 400)
        self.assertEqual(client.put(url, {**body, 'sections': []}, format='json').status_code, 400)
        response = client.put(f'/api/organization/members/{self.owner.id}/access/', body, format='json')
        self.assertEqual(response.status_code, 400)

    def test_cannot_pick_a_potrero_of_another_establecimiento(self):
        other_org = Organization.objects.create(name='El Ombú')
        foreign_yard = yard_repository.create(other_org.id, 'Ajeno', BOUNDARY)
        response = self.client_for(self.owner).put(
            f'/api/organization/members/{self.user.id}/access/',
            {'sections': ['alertas'], 'all_yards': False, 'yard_ids': [foreign_yard]}, format='json')
        self.assertEqual(response.status_code, 400)


class MemberTests(ApiTestCase):
    def test_add_member(self):
        client = self.client_for(self.owner)
        body = {'name': 'Fede Nuevo', 'email': 'Fede@Example.com', 'password': 'alambrado-sur-55'}
        response = client.post('/api/organization/members/', body, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['email'], 'fede@example.com')
        self.assertEqual(response.json()['role'], 'user')
        self.assertEqual(client.post('/api/organization/members/', body, format='json').status_code, 409)

    def test_weak_password_is_rejected(self):
        response = self.client_for(self.owner).post(
            '/api/organization/members/', {'name': 'Gabi', 'email': 'gabi@example.com', 'password': '12345678'},
            format='json')
        self.assertEqual(response.status_code, 400)

    def test_last_owner_cannot_leave(self):
        client = self.client_for(self.owner)
        url = f'/api/organization/members/{self.owner.id}/'
        self.assertEqual(client.patch(url, {'role': 'user'}, format='json').status_code, 409)
        self.assertEqual(client.delete(url).status_code, 409)

    def test_cannot_suspend_yourself(self):
        second = self.make_member('Hugo', 'hugo@example.com', 'owner')
        response = self.client_for(self.owner).patch(f'/api/organization/members/{self.owner.id}/',
                                                     {'active': False}, format='json')
        self.assertEqual(response.status_code, 409)
        response = self.client_for(second).patch(f'/api/organization/members/{self.owner.id}/',
                                                 {'active': False}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_reset_password_closes_the_member_sessions(self):
        user = self.make_member('Ines', 'ines@example.com')
        user_client = self.client_for(user)
        response = self.client_for(self.owner).post(f'/api/organization/members/{user.id}/password/',
                                                    {'new_password': 'molino-viejo-31'}, format='json')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(user_client.get('/api/me/').status_code, 401)


class DeviceTests(ApiTestCase):
    def test_pair_normalizes_the_number(self):
        response = self.client_for(self.owner).post('/api/devices/', {'device_uid': 'C-084'}, format='json')
        self.assertEqual(response.status_code, 201)
        device = Device.objects.get(device_uid='COLLAR-84')
        self.assertEqual((device.organization_id, device.label), (self.org.id, 'C-084'))

    def test_pair_claims_a_collar_that_already_transmitted(self):
        self.reading(uid='COLLAR-7')
        response = self.client_for(self.owner).post('/api/devices/', {'device_uid': '7'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Device.objects.get(device_uid='COLLAR-7').organization_id, self.org.id)

    def test_pair_conflicts(self):
        client = self.client_for(self.owner)
        self.assertEqual(client.post('/api/devices/', {'device_uid': '1'}, format='json').status_code, 409)
        other_org = Organization.objects.create(name='El Ombú')
        device_repository.create('COLLAR-9', organization_id=other_org.id)
        self.assertEqual(client.post('/api/devices/', {'device_uid': '9'}, format='json').status_code, 409)
        self.assertEqual(client.post('/api/devices/', {'device_uid': 'vaca'}, format='json').status_code, 400)

    def test_assign_and_unassign(self):
        client = self.client_for(self.owner)
        other = Animal.objects.create(organization_id=self.org.id, yard_id=self.yard_id, name='Vaca #085')
        url = f'/api/devices/{self.device.id}/'
        self.assertEqual(client.post(url + 'assign/', {'animal_id': other.id}, format='json').status_code, 409)
        self.assertEqual(client.post(url + 'unassign/', {'storage_location': 'Galpón'}, format='json').status_code,
                         200)
        self.assertEqual(client.post(url + 'unassign/', {}, format='json').status_code, 409)
        self.assertEqual(client.post(url + 'assign/', {'animal_id': other.id}, format='json').status_code, 200)

    def test_changing_the_interval_queues_a_command(self):
        client = self.client_for(self.owner)
        url = f'/api/devices/{self.device.id}/'
        self.assertEqual(client.patch(url, {'tx_interval_s': 5}, format='json').status_code, 400)
        body = client.patch(url, {'tx_interval_s': 120}, format='json').json()
        self.assertIn('set_interval', [c['command'] for c in body['pending_commands']])

    def test_maintenance_in_the_past_is_rejected(self):
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        response = self.client_for(self.owner).post(f'/api/devices/{self.device.id}/maintenance/',
                                                    {'scheduled_for': yesterday}, format='json')
        self.assertEqual(response.status_code, 400)
