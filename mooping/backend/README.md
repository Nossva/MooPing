# MooPing - Backend

Django + Django REST framework sobre la base PostgreSQL/PostGIS de [../db](../db).

## Instalación

```bash
cd mooping/backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # Linux/Mac: cp .env.example .env
```

## Correr

Con la base levantada (`docker compose up -d` en `mooping/db`):

```bash
python manage.py migrate        # crea solo las tablas internas de Django (auth, sesiones, admin)
python manage.py runserver
```

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
