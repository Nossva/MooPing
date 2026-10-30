---
name: MooPing
description: Monitoreo de ganado con collares AgroNeck, en celular y en PC.
colors:
  bordo-tranquera: "#670626"
  bordo-tranquera-deep: "#420014"
  bordo-tranquera-soft: "#ffd9dd"
  verde-potrero: "#4d6631"
  verde-potrero-soft: "#cce9a8"
  ambar-revision: "#f59e0b"
  ambar-revision-soft: "#fef3c7"
  ambar-revision-ink: "#92400e"
  tinta-noche: "#111c2d"
  tierra-muted: "#564244"
  tierra-outline: "#866e71"
  cielo-surface: "#f9f9ff"
  cielo-low: "#f0f3ff"
  cielo-mid: "#e7eeff"
  cielo-high: "#dee8ff"
  pergamino: "#fff8f6"
  blanco: "#ffffff"
typography:
  display:
    fontFamily: "Plus Jakarta Sans Variable, Inter Variable, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Plus Jakarta Sans Variable, Inter Variable, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Plus Jakarta Sans Variable, Inter Variable, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  body-small:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  label:
    fontFamily: "Inter Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.025em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.bordo-tranquera}"
    textColor: "{colors.blanco}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.bordo-tranquera-deep}"
  button-outline:
    backgroundColor: "{colors.blanco}"
    textColor: "{colors.bordo-tranquera}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-soft:
    backgroundColor: "{colors.cielo-high}"
    textColor: "{colors.bordo-tranquera}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-field:
    backgroundColor: "{colors.verde-potrero-soft}"
    textColor: "{colors.verde-potrero}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-green:
    backgroundColor: "{colors.verde-potrero}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.blanco}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-urgente:
    backgroundColor: "{colors.bordo-tranquera}"
    textColor: "{colors.blanco}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-revision:
    backgroundColor: "{colors.ambar-revision-soft}"
    textColor: "{colors.ambar-revision-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  badge-equipo:
    backgroundColor: "{colors.cielo-high}"
    textColor: "{colors.tinta-noche}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  metric:
    backgroundColor: "{colors.cielo-low}"
    rounded: "{rounded.lg}"
    padding: "10px 8px"
  nav-item-active:
    backgroundColor: "{colors.bordo-tranquera}"
    textColor: "{colors.blanco}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
---

# Design System: MooPing

## Overview

**Creative North Star: "Bordó sobre cielo claro"**

MooPing es una herramienta de trabajo: el estilo actual (salido del Figma "MooPing") se mantiene y se afina, no se reemplaza. Fondos claros con un leve tinte azul cielo, tarjetas blancas planas con borde casi invisible, y dos colores con significado: el bordó marca lo que exige acción (alertas urgentes, botones principales, el animal fuera del perímetro) y el verde marca el campo en orden (potreros, alertas en curso, estados OK). El ámbar queda para lo que pide revisión sanitaria.

La densidad es media: tarjetas apiladas en una columna en el celular, máximo 1024px de contenido en la PC, con métricas cortas en grillas de dos a cuatro. Los títulos usan Plus Jakarta Sans en negrita; todo el resto, Inter. La interfaz habla en español rioplatense y con vocabulario del campo.

Mejorar significa más legibilidad al sol, controles más fáciles de tocar, jerarquía más clara y estados honestos (cargando, vacío, error, dato viejo), sin cambiar la paleta ni el carácter.

**Key Characteristics:**
- Fondos azul cielo muy claro, tarjetas blancas planas.
- Bordó = acción o urgencia; verde = campo en orden; ámbar = revisión.
- Títulos en Plus Jakarta Sans 700; texto en Inter.
- Componentes firmes y claros: botones con buen tamaño táctil, tarjetas sin sombras protagonistas.
- Dos disposiciones de primera clase: barra inferior en celular, menú lateral en PC.

## Colors

Una paleta fría y clara con dos acentos cargados de significado, nunca decorativos.

### Primary
- **Bordó Tranquera** (#670626): botón principal, ítem activo del menú lateral, badge "Urgente", animal fuera del perímetro en el mapa, recorrido del animal, contador de alertas. Su versión profunda (#420014) es el hover; la suave (#ffd9dd) da fondo a avisos y burbujas de íconos urgentes.

### Secondary
- **Verde Potrero** (#4d6631): perímetros de potreros en el mapa, alertas asignadas o en curso, botones de confirmar. Su versión suave (#cce9a8) rellena los potreros y los botones de campo.

### Tertiary
- **Ámbar Revisión** (#f59e0b): alertas sanitarias (fiebre, baja actividad). Fondo #fef3c7 y texto #92400e para que el texto sobre ámbar sea legible.

### Neutral
- **Tinta Noche** (#111c2d): texto principal y títulos.
- **Tierra Muted** (#564244): texto secundario, etiquetas, ítems de menú inactivos.
- **Tierra Outline** (#866e71): token definido para bordes con contraste; hoy casi no se usa (los bordes son negro al 5–10%).
- **Cielo** (#f9f9ff → #f0f3ff → #e7eeff → #dee8ff): fondo de la app y capas tonales (métricas, botones suaves, badge "Equipo", pistas vacías de progreso).
- **Pergamino** (#fff8f6): fondo cálido para superficies especiales como el login.

### Named Rules
**La Regla del Bordó Ganado.** El bordó aparece solo donde hay algo que hacer o algo urgente. Si una pantalla está en calma, casi no debería verse bordó fuera del menú.

**La Regla del Semáforo de Campo.** Bordó urgente, ámbar revisión, verde en orden. Ningún color cambia de significado entre pantallas, ni en el mapa.

## Typography

**Display Font:** Plus Jakarta Sans Variable (con Inter Variable)
**Body Font:** Inter Variable (con system-ui)

**Character:** Plus Jakarta da a los títulos y números grandes un tono cercano y redondeado; Inter mantiene el texto chico nítido y neutro.

### Hierarchy
- **Display** (700, 2.25rem / 3rem en desktop, 1.25): titular del login y cifras protagonistas (ej. % de salud del rodeo).
- **Headline** (700, 1.875rem, 1.2): título de página dentro del contenido (ej. "Equipos y red").
- **Title** (700, 1.125–1.25rem, 1.4): títulos de sección y nombre del animal en una tarjeta de alerta.
- **Body** (400–600, 0.875rem, 1.43): texto general, botones.
- **Body small** (400–600, 0.75rem, 1.33): metadatos, tiempos ("hace 5 min"), texto de apoyo. Es el tamaño más usado.
- **Label** (700, 11px, tracking 0.025em, MAYÚSCULAS): badges de categoría y etiquetas de métricas.

### Named Rules
**La Regla del Piso de 11px.** Nada de texto con información por debajo de 11px. Los 9–10px existentes (contador del nav, pasos de estado) son deuda a corregir, no un patrón.

## Layout

- **Celular (< 768px):** una columna, padding lateral de 16px, header fijo de 64px con logo y título centrado en mayúsculas, barra de navegación inferior fija de 64px; el contenido deja 112px abajo para no quedar tapado.
- **PC (≥ 768px):** menú lateral fijo de 256px con logo, navegación, usuario y cierre de sesión; header de 64px con título a la izquierda; contenido centrado con ancho máximo de 1024px.
- **Ritmo:** escala de 4px (4, 8, 12, 16, 24). Separación entre tarjetas de 12–16px; padding interno de tarjeta 16px.
- Métricas en filas de 2 a 4 celdas iguales.

## Elevation & Depth

Plano por defecto, con capas tonales. La profundidad viene del contraste entre el fondo cielo y las tarjetas blancas, más un borde negro al 5%. La sombra de tarjeta es apenas perceptible (`0 1px 2px rgba(0,0,0,0.04)`). Las sombras más marcadas solo aparecen en lo que flota: menús desplegables del header, marcadores del mapa y el logo del login.

### Named Rules
**La Regla de lo que Flota.** Solo lleva sombra visible lo que está por encima del contenido: menús, popovers, marcadores. Las tarjetas no compiten por altura.

## Shapes

Esquinas suaves y consistentes: 8px en botones, campos e ítems de menú; 12px en tarjetas y avisos; 6px en badges; círculo completo en pills, burbujas de íconos (44px), contadores y marcadores del mapa. El perímetro de potrero en el mapa es una línea verde punteada (6/6) con relleno verde suave al 25%.

## Components

### Buttons
Firmes y claros: buen tamaño táctil, sin efectos.
- **Shape:** esquinas suaves (8px), padding 12px × 16px, texto 14px semibold, ícono de 16px a la izquierda.
- **Primary:** fondo Bordó Tranquera, texto blanco; hover Bordó profundo.
- **Outline:** fondo blanco, borde bordó al 40%, texto bordó.
- **Soft:** fondo cielo alto, texto bordó (acciones secundarias).
- **Field / Green:** verde suave con texto verde, o verde pleno con texto blanco (confirmar, resolver).
- **Busy / Disabled:** spinner reemplaza al ícono; opacidad 60% y cursor bloqueado.

### Chips
- **Badge:** 11px, negrita, mayúsculas, esquina 6px. Urgente (bordó/blanco), Sanitaria (ámbar suave/ámbar tinta), Equipo (cielo/tinta).
- **Pill:** forma de píldora, 11px semibold, para estados y etiquetas cortas.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** blanco sobre fondo cielo.
- **Shadow Strategy:** casi plana (ver Elevation & Depth).
- **Border:** negro al 5%; una alerta urgente destacada suma borde bordó al 30% y anillo al 20%.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** borde negro al 10%, fondo blanco (o cielo bajo en notas), esquina 8px, padding 10px × 12px, texto 14px Tinta Noche. El login usa un campo envolvente de 12px de esquina con anillo negro al 5% y sombra mínima.
- **Focus:** hoy es inconsistente: algunos campos pasan el borde a bordó al 40% o el anillo a bordó al 40%, y la mayoría depende del foco del navegador. Unificar en anillo bordó al 40%.

### Navigation
- **PC:** menú lateral blanco; ítem activo con fondo bordó y texto blanco, inactivos en Tierra Muted con hover cielo bajo; el contador de alertas es una pill bordó suave.
- **Celular:** barra inferior blanca, ícono 20px sobre etiqueta de 11px; el activo en bordó semibold; contador como círculo bordó sobre el ícono.

### Tarjeta de alerta (signature)
Burbuja de ícono de 44px tintada según categoría, nombre del animal como Title, badge de categoría, tipo de alerta en 12px semibold, fila de métricas (valor en Plus Jakarta bold sobre fondo cielo bajo), y una barra de progreso de cuatro pasos (Pendiente → Asignada → En curso → Resuelta): bordó mientras está pendiente, verde una vez que alguien la tomó.

### Mapa del rodeo (signature)
Leaflet con potreros verdes punteados. Marcadores circulares con borde blanco de 3px: verde si el animal está bien, ámbar si tiene alerta, bordó con pulso suave si está fuera del perímetro. El recorrido del animal es una línea bordó de 3px al 80%.

## Do's and Don'ts

### Do:
- **Do** mantener la paleta y las tipografías actuales; mejorar es afinar, no reemplazar.
- **Do** usar los tokens de `src/index.css` (`bg-brand`, `text-field`, `bg-surface-low`…) en vez de hex sueltos.
- **Do** respetar el semáforo: bordó urgente, ámbar revisión, verde en orden, también en el mapa.
- **Do** diseñar cada pantalla en celular y en PC; las dos son de primera clase.
- **Do** mostrar siempre cuándo fue el último dato ("hace 5 min") junto a datos de telemetría.

### Don't:
- **Don't** usar texto con información por debajo de 11px.
- **Don't** agregar sombras grandes a tarjetas ni gradientes decorativos.
- **Don't** usar colores de Tailwind sin token (red-500, gray-400…) ni hex fuera de la paleta; el ámbar del marcador del mapa (#b45309) debería alinearse con Ámbar Revisión.
- **Don't** usar el bordó como decoración en pantallas sin nada urgente.
