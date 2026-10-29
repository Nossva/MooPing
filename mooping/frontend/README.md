# MooPing Frontend

App web de MooPing (React + Vite + Tailwind 4), basada en el diseño de Figma
[MooPing](https://www.figma.com/design/GzfTGCZ0LXDHUkH2AGWyQ8/MooPing). Consume la API de
`mooping/backend` (ver `backend/ENDPOINTS.md`).

## Pantallas

| Ruta | Pantalla | Endpoints principales |
|---|---|---|
| — | Login (`1 · Acceso al Sistema`) | `auth/login/`, `health/` |
| `/` | Inicio | `dashboard/summary/`, `alerts/`, `devices/?filter=needs_attention` |
| `/monitoreo` | Monitoreo + mapa en vivo | `yards/`, `monitoring/summary/`, `animals/positions/`, `animals/{id}/`, `animals/{id}/track/` |
| `/alertas` | Centro de alertas | `alerts/summary/`, `alerts/`, `notification-settings/` |
| `/equipos` | Equipos y red | `infrastructure/summary/`, `devices/`, `gateways/`, `products/` |

En celular se ve con barra de navegación inferior (como el diseño mobile); en
pantallas anchas, con menú lateral.

## Correr

Con todo el entorno (base + backend + frontend):

```bash
cd mooping
docker compose up -d --build
docker exec mooping-backend python manage.py seed_demo   # datos de demo (una vez)
```

Abrir http://localhost:5173 y entrar con `demo@mooping.app` / `mooping123`.

Solo el frontend, con el backend ya corriendo en :8000:

```bash
cd mooping/frontend
npm install
npm run dev
```

Vite proxyea `/api` a `http://localhost:8000` (o a `BACKEND_URL`).

## Estructura

```
src/
  api/          cliente HTTP (token Bearer), hook useApi, contexto de sesión
  components/   Layout (header, barra de estado, navegación), tarjetas, mapa (Leaflet)
  pages/        Login, Inicio, Monitoreo, Alertas, Equipos
  lib/          formato de fechas/números, textos de alertas
```

Los colores y tipografías (Plus Jakarta Sans + Inter) salen del archivo de Figma y
están en `src/index.css` (`--color-brand`, `--color-field`, etc.).
