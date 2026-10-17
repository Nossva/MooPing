# MooPing

```
mooping/
├── docker-compose.yml   levanta todo: base de datos + backend
├── db/                  schema.sql (PostgreSQL + PostGIS)
└── backend/             Django + DRF (traffic / services / repositories / entities)
```

## Primera vez (y siempre)

Solo hace falta **Docker Desktop** abierto. No hace falta instalar Python ni crear el venv.

```bash
cd mooping
docker compose up -d --build
```

La primera vez:
1. Descarga las imágenes y construye el backend (tarda unos minutos).
2. Crea la base `mooping` y ejecuta `db/schema.sql`.
3. Corre `python manage.py migrate` y arranca Django.

Probar: http://localhost:8000/api/health/ → `{"status":"ok","database":"ok"}`

## Comandos útiles

| Qué | Comando |
|---|---|
| Ver logs del backend | `docker compose logs -f backend` |
| Apagar todo | `docker compose down` |
| Reconstruir tras cambiar `requirements.txt` | `docker compose up -d --build` |
| Correr un comando de Django | `docker compose exec backend python manage.py <comando>` |
| Abrir la base (psql) | `docker compose exec db psql -U mooping -d mooping` |
| Borrar la base y recrearla desde `schema.sql` | `docker compose down -v` y después `docker compose up -d` |

Los cambios en el código del backend se recargan solos, sin reiniciar el contenedor.

## Puertos ocupados

Si ya tenés algo en el 5432 o el 8000, creá un archivo `.env` en `mooping/`:

```
DB_PORT=5433
BACKEND_PORT=8001
```

Datos de conexión desde tu PC (DBeaver, pgAdmin, etc.):
`postgres://mooping:mooping@localhost:5432/mooping`
