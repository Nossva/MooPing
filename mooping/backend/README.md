# MooPing - Backend

Django + Django REST framework sobre la base PostgreSQL/PostGIS de [../db](../db).

## Correr con Docker (recomendado)

Desde `mooping/`: `docker compose up -d --build`. Levanta la base y el backend,
corre `migrate` y queda en http://localhost:8000. Ver [../README.md](../README.md).

## Correr sin Docker para el backend (opcional)

Útil para depurar desde VS Code. Requiere Python 3.12+ y la base levantada
(`docker compose up -d db` desde `mooping/`). Si el contenedor `mooping-backend`
está corriendo, apagalo antes (`docker compose stop backend`) porque usa el puerto 8000.

```bash
cd mooping/backend
python manage.py migrate        # crea solo las tablas internas de Django (auth, sesiones, admin)
python manage.py runserver
```

No hace falta crear el venv ni el `.env` a mano: la primera vez que se ejecuta
`manage.py` crea `.venv/`, instala `requirements.txt` (y lo reinstala si cambia)
y genera `.env` (plantilla `ENV_TEMPLATE` en `config/settings.py`) con una
`DJANGO_SECRET_KEY` aleatoria.
Después se relanza solo con el Python del venv, así que tampoco hace falta activarlo.

Probar: http://localhost:8000/api/health/ → `{"status": "ok", "database": "ok"}`

## Estructura

```
backend/
├── config/              configuración del proyecto (settings, urls)
├── api/
│   ├── urls.py          rutas -> traffic
│   ├── traffic/         capa de tráfico: views + serializers (HTTP)
│   ├── services/        capa de servicio: reglas de negocio
│   ├── repositories/    capa de repositorio: acceso a la base
│   └── entities/        entidades: modelos Django de las tablas
├── manage.py
└── requirements.txt
```

## Capas

```
request -> traffic -> services -> repositories -> base de datos
                                       ↕
                                   entities
```

| Capa | Hace | No hace |
|---|---|---|
| `traffic/` | Recibe el request, valida con serializers, llama a **un** service y arma el `Response` | Lógica de negocio, consultas a la base |
| `services/` | Reglas de negocio; combina repositorios | Tocar `request`/`Response`, consultar la base directamente |
| `repositories/` | Todas las consultas (ORM o SQL) | Reglas de negocio, HTTP |
| `entities/` | Modelos Django de las tablas de `db/schema.sql` | Lógica |

Cada capa solo llama a la de abajo. Un archivo por recurso en cada capa
(`animal_views.py`, `animal_service.py`, `animal_repository.py`, `animal.py`).
`health` es el ejemplo de referencia.

Las tablas de MooPing las define `db/schema.sql`. Las entidades van con
`managed = False`, así `migrate` nunca las modifica.
