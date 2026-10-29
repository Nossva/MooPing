"""Demo establecimiento matching the Figma screens (El Ombú, Vaca #084 fuera
del perímetro, Vaca #215 con fiebre, C-098 sin señal...).
Readings go through telemetry_service.ingest, so alerts are produced by the
same rules the Pi data uses."""
import random
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from api.dto.request.alert_request import AlertUpdateRequest, NoteCreateRequest
from api.dto.request.animal_request import AnimalCreateRequest
from api.dto.request.device_request import AssignRequest, DevicePairRequest
from api.dto.request.telemetry_request import TelemetryReadingRequest
from api.repositories import (
    alert_repository,
    device_repository,
    gateway_repository,
    organization_repository,
    user_repository,
    yard_repository,
)
from api.services import alert_service, animal_service, auth_service, device_service, telemetry_service
from api.services.errors import Conflict

ORG_NAME = 'El Ombú'
DEMO_PASSWORD = 'mooping123'
USERS = [
    ('Juan Pérez', 'demo@mooping.app', '+54 9 2326 555-0101', 'owner'),
    ('María Gómez', 'maria@mooping.app', '+54 9 2326 555-0102', 'user'),
]

POTRERO_SUR = {'type': 'Polygon', 'coordinates': [[
    [-59.505, -34.275], [-59.445, -34.275], [-59.440, -34.240],
    [-59.470, -34.225], [-59.510, -34.240], [-59.505, -34.275],
]]}
POTRERO_NORTE = {'type': 'Polygon', 'coordinates': [[
    [-59.510, -34.240], [-59.470, -34.225], [-59.470, -34.200],
    [-59.515, -34.205], [-59.510, -34.240],
]]}
# Inner boxes (lng_min, lng_max, lat_min, lat_max) where normal walks stay.
SUR_BOX = (-59.495, -59.455, -34.268, -34.242)
NORTE_BOX = (-59.505, -59.478, -34.230, -34.212)

GATEWAYS = [
    ('AGROBOT-01', 'Molino Sur', 'gateway', 'solar', 94, 'LoRa 433 MHz', 2000),
    ('AGROBOT-02', 'Casco', 'gateway', 'grid', None, 'LoRa 433 MHz', 1500),
    ('REP-01', 'Nodo Cerro Vigía', 'repeater', 'solar', 81, 'LoRa 433 MHz', None),
]

# name, tag, breed, sex, age_months, lot, yard, collar uid, label, scenario
ANIMALS = [
    ('Vaca #084', 'AR-039-994', 'Aberdeen Angus', 'female', 40, 'Rodeo 3', 'sur', 'COLLAR-84', 'C-084', 'outside'),
    ('Vaca #215', 'AR-039-215', 'Aberdeen Angus', 'female', 18, 'Lote Inseminación', 'sur', 'COLLAR-215', 'C-215', 'fever'),
    ('Vaca #142', 'AR-039-142', 'Angus Negra', 'female', 52, 'Rodeo 3', 'sur', 'COLLAR-882', 'C-882', 'normal'),
    ('Toro #012', 'AR-039-012', 'Hereford', 'male', 60, 'Reproductores', 'sur', 'COLLAR-114', 'C-114', 'normal'),
    ('Ternero #441', 'AR-039-441', 'Brangus', 'male', 7, 'Recría', 'norte', 'COLLAR-98', 'C-098', 'no_signal'),
    ('Vaca #103', 'AR-039-103', 'Aberdeen Angus', 'female', 44, 'Rodeo 3', 'sur', 'COLLAR-103', 'C-103', 'returned'),
    ('Vaca #118', 'AR-039-118', 'Aberdeen Angus', 'female', 36, 'Rodeo 3', 'sur', 'COLLAR-118', 'C-118', 'normal'),
    ('Vaca #127', 'AR-039-127', 'Angus Negra', 'female', 48, 'Rodeo 3', 'sur', 'COLLAR-127', 'C-127', 'normal'),
    ('Vaca #156', 'AR-039-156', 'Hereford', 'female', 30, 'Lote Inseminación', 'sur', 'COLLAR-156', 'C-156', 'normal'),
    ('Vaquillona #201', 'AR-039-201', 'Brangus', 'female', 20, 'Recría', 'norte', 'COLLAR-201', 'C-201', 'normal'),
    ('Novillo #305', 'AR-039-305', 'Hereford', 'male', 22, 'Recría', 'norte', 'COLLAR-305', 'C-305', 'normal'),
    ('Vaca #330', 'AR-039-330', 'Angus Negra', 'female', 56, 'Rodeo 3', 'sur', 'COLLAR-330', 'C-330', 'normal'),
]
STOCK_COLLARS = [('COLLAR-205', 'C-205'), ('COLLAR-206', 'C-206')]
ALL_COLLAR_UIDS = [a[7] for a in ANIMALS] + [uid for uid, _ in STOCK_COLLARS]


def _walk(rng, box, start, step_deg=0.0012):
    lng = min(max(start[0] + rng.uniform(-step_deg, step_deg), box[0]), box[1])
    lat = min(max(start[1] + rng.uniform(-step_deg, step_deg), box[2]), box[3])
    return lng, lat


def _birth_date(months):
    today = timezone.localdate()
    return today - timedelta(days=round(months * 30.4))


def _reading(uid, when, lng, lat, temp, rumination, gateway='AGROBOT-01'):
    return {'ID': uid, 'LAT': lat, 'LONG': lng, 'TEMP': temp, 'RUM': rumination,
            'TS': when.isoformat(), 'GW': gateway}


def _readings_for(rng, animal, now):
    """Chronological readings: 3 per day for the past 6 days, every 20 min for
    the last 24 h, plus the animal's scenario."""
    _, _, _, _, _, _, yard, uid, _, scenario = animal
    box = SUR_BOX if yard == 'sur' else NORTE_BOX
    gateway = 'AGROBOT-01' if yard == 'sur' else 'AGROBOT-02'
    pos = (rng.uniform(box[0], box[1]), rng.uniform(box[2], box[3]))
    readings = []

    local_midnight = timezone.localtime(now).replace(hour=0, minute=0, second=0, microsecond=0)
    for days_ago in range(6, 0, -1):
        if rng.random() < 0.08:          # some collars miss a day -> trend is not flat
            continue
        for hour in (10, 14, 18):
            when = local_midnight - timedelta(days=days_ago) + timedelta(hours=hour)
            pos = _walk(rng, box, pos, 0.004)
            readings.append(_reading(uid, when, *pos, round(rng.uniform(38.2, 38.8), 1),
                                     rng.randint(6, 10), gateway))

    end = now - timedelta(minutes=rng.randint(1, 3))
    if scenario == 'no_signal':
        end = now - timedelta(minutes=45)
    when = now - timedelta(hours=24)
    while when <= end:
        minutes_ago = (now - when).total_seconds() / 60
        temp = round(rng.uniform(38.2, 38.8), 1)
        rumination = rng.randint(6, 10)
        point = _walk(rng, box, pos)
        if scenario == 'fever' and minutes_ago <= 240:
            temp = round(39.3 + (240 - minutes_ago) / 240 * 0.6, 1)
            rumination = 0
        if scenario == 'returned' and 160 <= minutes_ago <= 180:
            point = (-59.437, -34.262)       # east of the boundary for 20 min
        readings.append(_reading(uid, when, *point, temp, rumination, gateway))
        if not (scenario == 'returned' and 160 <= minutes_ago <= 180):
            pos = point
        when += timedelta(minutes=20)

    if scenario == 'outside':
        # Last 8 minutes: walking east out of the potrero towards the road.
        for minutes_ago, lng in ((12, -59.4425), (8, -59.4385), (4, -59.4378)):
            readings.append(_reading(uid, now - timedelta(minutes=minutes_ago), lng, -34.2522,
                                     38.6, 4, gateway))
    return readings


@transaction.atomic
def seed(reset=False):
    existing = organization_repository.get_by_name(ORG_NAME)
    if existing and not reset:
        raise Conflict(f'Ya existe "{ORG_NAME}". Usá --reset para recrearlo.')
    if existing:
        organization_repository.delete(existing.id)
    user_repository.delete_by_emails([u[1] for u in USERS])
    device_repository.delete_by_uids(ALL_COLLAR_UIDS)

    org = organization_repository.create(ORG_NAME, vet_phone='+54 9 2326 555-0199')
    users = {}
    for name, email, phone, role in USERS:
        user = user_repository.create(name, email, auth_service.hash_password(DEMO_PASSWORD), phone)
        user_repository.add_membership(org.id, user.id, role)
        users[email] = user
    juan = users['demo@mooping.app']

    for uid, name, kind, power, battery, radio, coverage in GATEWAYS:
        gateway = gateway_repository.create(org.id, uid, name=name, kind=kind, power_source=power,
                                            battery_pct=battery, radio=radio, coverage_ha=coverage)
        gateway_repository.touch(gateway.id)

    yards = {
        'sur': yard_repository.create(org.id, 'Potrero 4 (Sur)', POTRERO_SUR),
        'norte': yard_repository.create(org.id, 'Potrero Norte', POTRERO_NORTE),
    }

    animal_ids = {}
    for name, tag, breed, sex, months, lot, yard, uid, label, _ in ANIMALS:
        animal = animal_service.create_animal(org.id, AnimalCreateRequest(
            name=name, tag_number=tag, breed=breed, sex=sex, birth_date=_birth_date(months), lot=lot,
            yard_id=yards[yard]))
        device = device_service.pair_device(org.id, DevicePairRequest(
            uid, label=label, firmware_version='v2.4.1', hardware_version='AgroNeck r2',
            battery_model='ER34615 (3.6V D)'))
        device_service.assign_device(org.id, device.id, AssignRequest(animal.id))
        animal_ids[name] = animal.id
    for uid, label in STOCK_COLLARS:
        device_service.pair_device(org.id, DevicePairRequest(
            uid, label=label, firmware_version='v2.4.1', storage_location='Stock en galpón de herramientas'))
    device_repository.update(device_repository.get_by_uid('COLLAR-114'), tx_interval_s=120)

    rng = random.Random(42)
    now = timezone.now()
    # Readings start 6 days ago: the collars were put on before that.
    device_repository.backdate_assignments(org.id, now - timedelta(days=7))
    readings = sorted(
        (r for animal in ANIMALS for r in _readings_for(rng, animal, now)),
        key=lambda r: r['TS'],
    )
    for raw in readings:
        telemetry_service.ingest(TelemetryReadingRequest.from_payload(raw))
    alert_service.check_no_signal()

    # Workflow state shown in the Figma cards.
    fever = alert_repository.find_open('fever', animal_id=animal_ids['Vaca #215'])
    alert_service.update_alert(org.id, fever.id, juan, AlertUpdateRequest(status='in_progress', assigned_to=juan.id))
    alert_service.add_note(org.id, fever.id, juan, NoteCreateRequest('Casi no rumia. Revisar en la manga a la tarde.'))
    returned = alert_repository.list_rows(org.id, status='resolved', animal_id=animal_ids['Vaca #103'])
    for record in returned:
        alert_repository.update(alert_repository.get(org.id, record.id), resolved_by_id=juan.id)

    return {
        'organization_id': org.id,
        'login': {'email': 'demo@mooping.app', 'password': DEMO_PASSWORD},
        'animals': len(ANIMALS),
        'collars': len(ALL_COLLAR_UIDS),
        'readings': len(readings),
        'open_alerts': alert_repository.count_open(org.id),
        'timezone': settings.TIME_ZONE,
    }
