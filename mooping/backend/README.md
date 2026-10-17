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
│   ├── traffic/         capa de tráfico (HTTP): urls.py (rutas), *_views.py, serializers
│   ├── dto/
│   │   ├── request/     <recurso>_request.py: lo que reciben los services
│   │   └── response/    <recurso>_response.py: lo que devuelve la API
│   ├── services/        capa de servicio: reglas de negocio
│   ├── repositories/    capa de repositorio: acceso a la base (devuelve records tipados)
│   └── entities/        entidades: modelos Django de las tablas + reglas de dominio
├── manage.py
└── requirements.txt
```

## Capas

```
HTTP ─► traffic ──RequestDTO──► services ──► repositories ──► base de datos
   ◄──── JSON ◄──ResponseDTO───┘      ▲            │
                                      └── records / entities
```

| Capa | Hace | No hace |
|---|---|---|
| `traffic/` | Valida con serializers, arma el **RequestDTO**, llama a **un** service y convierte el **ResponseDTO** en JSON (`traffic/http.py`) | Lógica de negocio, consultas a la base |
| `dto/` | Define cada request y response. Los responses se arman con `from_record` / `from_entity` / `build`, y ahí vive la presentación (km/h, "Este 94°", edad en meses) | Lógica de negocio, consultas |
| `services/` | Reciben RequestDTO, aplican las reglas de negocio y devuelven ResponseDTO | Tocar `request`/`Response`, consultar la base directamente |
| `repositories/` | Todas las consultas (ORM o SQL). Devuelven entities o records tipados (`repositories/records.py`) | Reglas de negocio, HTTP, DTOs |
| `entities/` | Modelos Django de las tablas de `db/schema.sql` y reglas de dominio puras (`rules.py`: categoría de alerta, días de batería, estado del collar) | I/O |

Dependencias permitidas (de arriba hacia abajo):
`traffic → dto, services` · `services → dto, repositories, entities` ·
`dto → entities` · `repositories → entities`.

Un archivo por recurso en cada capa: `animal_views.py`,
`dto/request/animal_request.py`, `dto/response/animal_response.py`,
`animal_service.py`, `animal_repository.py` y `animal.py`. Lo compartido de
cada lado está en `dto/request/base.py` (`UNSET`, `PatchRequest`) y en
`dto/response/base.py` (`to_json`, `Ref` y los helpers de presentación). `health` es el
ejemplo más simple.

**Records tipados:** cada `SELECT` de un repository tiene que devolver
exactamente los campos de su record. Si una columna se renombra o falta,
`from_row` falla en el momento con un error que dice qué falta y qué sobra.

Las tablas de MooPing las define `db/schema.sql`. Las entidades van con
`managed = False`, así `migrate` nunca las modifica.
