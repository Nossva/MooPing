from api.dto.response.health_response import HealthResponse
from api.repositories import health_repository


def get_health():
    try:
        health_repository.ping_database()
        database = 'ok'
    except Exception as error:
        database = f'error: {error}'
    return HealthResponse(status='ok', database=database)
