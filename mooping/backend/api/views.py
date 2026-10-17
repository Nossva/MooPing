from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['GET'])
def health(request):
    """Liveness check: confirms the server is up and the database answers."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        database = 'ok'
    except Exception as error:
        database = f'error: {error}'
    return Response({'status': 'ok', 'database': database})
