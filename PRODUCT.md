# Product

<!-- impeccable:product-schema 1 -->

Alcance: la app web MooPing (`mooping/frontend` + `mooping/backend`). La landing de AgroNomad (`web/`) queda fuera de este archivo.

## Platform

web

## Users

- **Dueño del establecimiento** (rol `Dueño`): ve y edita todo, administra usuarios, potreros, collares y el establecimiento.
- **Personal del campo** (rol `Usuario`): ve todo, atiende alertas y recibe las alarmas, pero no edita.

Ambos roles usan la app tanto en PC como en celular; las dos versiones son de primera clase. En celular la navegación es una barra inferior; en pantallas anchas, un menú lateral. No hay que suponer que un rol vive en un solo dispositivo.

## Product Purpose

MooPing es la interfaz de AgroNomad (antes llamada AgroServer): muestra y gestiona lo que mandan los collares inteligentes AgroNeck a través de la estación AgroBot. Sirve para saber dónde está cada animal, detectar a tiempo problemas sanitarios o de equipo, y coordinar quién los atiende. El éxito es que ninguna alerta importante (animal fuera del perímetro, fiebre, collar sin señal) pase desapercibida ni quede sin dueño.

## Positioning

Es el último eslabón de un sistema propio de punta a punta: collar con GPS y sensores (AgroNeck), recepción LoRa en una estación fija en el campo (AgroBot, Raspberry Pi) y esta app. No depende de cobertura celular en el animal: los datos viajan por LoRa hasta el gateway.

## Operating Context

- Flujo central: Inicio (resumen + alertas ordenadas por urgencia + equipos que necesitan atención) → Monitoreo (mapa en vivo de potreros y animales, recorrido de cada animal) → Alertas (centro de alertas con ciclo Pendiente → Asignada → En curso → Resuelta) → Equipos (collares, gateways, stock).
- Además: Administración (solo Dueño), Mi cuenta, Soporte.
- Uso en el campo: luz solar, conexión irregular, una mano ocupada; uso en escritorio: revisión y administración.
- Datos de telemetría: posición, temperatura, actividad, batería del collar, señal LoRa (RSSI/SNR) y estado de conexión del gateway.

## Capabilities and Constraints

- Tipos de alerta: Fuera del perímetro, Fiebre probable, Baja actividad, Sin señal. Categorías: Urgente, Sanitaria, Equipo.
- Potreros con perímetro (geocerca) editable; al cambiar el potrero se reevalúa "fuera del perímetro".
- Stack existente: React 19 + Vite + Tailwind 4 + Leaflet; backend Django + DRF sobre PostgreSQL/PostGIS; todo con Docker Compose.
- Idioma de la interfaz: español rioplatense (voseo).
- Etapa: prototipo funcional en camino a venderse a productores reales. Precio, planes y modelo comercial: sin definir.

## Brand Commitments

- Nombres: AgroNomad (proyecto/empresa), MooPing (app), AgroNeck (collar), AgroBot (estación).
- Logo de la app: `mooping/frontend/src/assets/mooping-logo.png`. Logo AgroNomad: `docs/Logo Green AgroNomad.png`.
- Existe un diseño en Figma de referencia (ver `mooping/frontend/README.md`).

## Evidence on Hand

- Datos de demo: establecimiento "El Ombú", 12 animales en 2 potreros, 7 días de lecturas y casos típicos (vaca fuera del perímetro, vaca con fiebre, collar sin señal, collares en stock).
- Documentación del proyecto en `docs/` (anteproyecto, carpeta de campo, informes y presentación ONIET).
- No hay todavía clientes, testimonios, métricas de campo ni casos de éxito: no inventarlos.

## Product Principles

1. Lo urgente primero: la app ordena por urgencia y nunca esconde una alerta crítica detrás de navegación.
2. Cada alerta tiene un responsable y un estado; el objetivo es cerrarla, no solo verla.
3. Funciona igual de bien en el celular en el campo que en la PC: mismas capacidades, distinta disposición.
4. Datos honestos: mostrar cuándo un dato es viejo o un equipo perdió señal, en vez de aparentar que todo está en vivo.
5. Lenguaje del campo, no de ingeniería: potrero, animal, collar, perímetro.
