from api.repositories.db import execute, fetch_one, fetch_value
from api.repositories.records import MotionRecord


def motion_since_last(device_id, lng, lat, recorded_at):
    """Distance (m), seconds and azimuth (deg) from the collar's previous
    positioned reading to the new point, or None if there is no previous one."""
    return fetch_one(
        """SELECT ST_Distance(location, ST_MakePoint(%s, %s)::geography)::float AS distance_m,
                  EXTRACT(EPOCH FROM (%s::timestamptz - recorded_at))::float AS seconds,
                  degrees(ST_Azimuth(location, ST_MakePoint(%s, %s)::geography))::float AS heading_deg
           FROM telemetry_readings
           WHERE device_id = %s AND location IS NOT NULL AND recorded_at < %s
           ORDER BY recorded_at DESC LIMIT 1""",
        [lng, lat, recorded_at, lng, lat, device_id, recorded_at],
        MotionRecord,
    )


def insert(device_id, animal_id, gateway_id, recorded_at, lng, lat, **values):
    """values: optional telemetry columns (temp_body_c, activity, ...)."""
    columns = ['device_id', 'animal_id', 'gateway_id', 'recorded_at']
    params = [device_id, animal_id, gateway_id, recorded_at]
    placeholders = ['%s'] * 4
    if lng is not None and lat is not None:
        columns.append('location')
        placeholders.append('ST_MakePoint(%s, %s)::geography')
        params += [lng, lat]
    for name, value in values.items():
        if value is not None:
            columns.append(name)
            placeholders.append('%s')
            params.append(value)
    return execute(
        f"INSERT INTO telemetry_readings ({', '.join(columns)}) VALUES ({', '.join(placeholders)}) RETURNING id",
        params,
    )


def last_packet_at(organization_id):
    return fetch_value('SELECT max(last_seen_at) FROM devices WHERE organization_id = %s', [organization_id])
