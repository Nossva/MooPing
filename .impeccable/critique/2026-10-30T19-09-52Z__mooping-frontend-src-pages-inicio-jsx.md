---
target: Inicio.jsx
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Inicio.jsx"
target_fingerprint: "sha256:5f063b7097abbff33498e1ce7b0863594edda75ce8dfc2d7bfc5398664799532"
target_path: "C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Inicio.jsx"
timestamp: 2026-10-30T19-09-52Z
slug: mooping-frontend-src-pages-inicio-jsx
closed: true
---
Method: dual-agent (A: revisión de diseño · B: detector + navegador). Sin inspección visual: la extensión de Chrome no estaba conectada; A revisó el código, B corrió el detector sobre el código y sobre la URL del login.

## Puntaje de diseño
| # | Heurística | Nota | Problema principal |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Refresca cada 30 s en silencio; nunca dice "actualizado hace X" ni avisa sin conexión |
| 2 | Coincidencia con el mundo real | 3 | Muy buen lenguaje de campo; "Salud del rodeo" mide collares reportando; "ping forzado" y estados crudos |
| 3 | Control y libertad | 2 | Asignar / En curso / Resolver con un toque, sin confirmar ni deshacer |
| 4 | Consistencia | 2 | "Sanitaria" vs "Revisión"; botón "En curso" es un estado, no un verbo; alertas de equipo en ámbar |
| 5 | Prevención de errores | 2 | "Asignar" se asigna a uno mismo sin decirlo; nada se confirma |
| 6 | Reconocer antes que recordar | 3 | Íconos con etiqueta, badges con texto, tiempos en todos lados |
| 7 | Flexibilidad y eficiencia | 2 | Chips del banner filtran Alertas; no hay vista compacta ni acciones en lote |
| 8 | Estética y minimalismo | 3 | Limpio; el banner con sombra y blur rompe La Regla de lo que Flota |
| 9 | Recuperación de errores | 1 | Un error de carga se muestra como "todo en orden"; mensajes técnicos |
| 10 | Ayuda y documentación | 2 | Buenos vacíos y "Empezá por acá"; sin ayuda contextual |
| **Total** | | **22/40** | **Aceptable** |

## Veredicto de especificidad
Hecha para este producto: banner en voseo con "Empezá por acá", tarjeta de alerta con métricas por tipo y ciclo Pendiente→Resuelta, "Asignadas a vos", "Resuelto hoy" con quién. Genéricos: la tarjeta KPI "Salud del rodeo" con sparkline y el banner bordó lleno con chips translúcidos. Detector: 0 hallazgos en Inicio.jsx y components/ (solo regex en .jsx, subconteo); 1 hallazgo advisory en el login: placeholder #897174 sobre blanco, 4,49:1.

## Problemas prioritarios
- [P0] Errores y carga se muestran como "todo en orden" (Inicio.jsx:57-63, 75-79). harden.
- [P1] Sin indicador de frescura ni de conexión (Inicio.jsx:17-20). harden.
- [P1] Cambios de estado de un toque sin red ni verbos claros (AlertCard.jsx:92-95, 178-184). clarify + harden.
- [P2] En celular la lista de tarjetas completas entierra equipos (Inicio.jsx:39-84). distill + adapt.
- [P2] Bordó y semáforo mal usados: banner siempre bordó con sombra/blur, chip Urgente destacado en 0, equipo en ámbar, hex suelto en sparkline. polish.

## Personas
Casey: texto 10-12px muted al sol, tarjetas largas, toques accidentales. Sam: sin focus-visible global, progreso solo visual, contador 9px, chips disabled iguales a activos, sparkline sin texto. Alex: no asigna a otros ni en lote, KPI engañoso, TeamCard arriba. Peón: "ping"/estado crudo, "Asignar" ambiguo, botones pegados, 🎉 ante error de red.

## Menores
"hace 0 s"; "5 min" ambiguo bajo "Último dato"; pct null → "—%" y NaN en sparkline; highlight solo si la primera es crítica; TeamCard sin foco; "Resuelto hoy" sin aria-expanded; dos bloques bordó seguidos con el aviso de alarmas; fecha 11px white/80.

## Preguntas
¿Inicio debería mostrar solo lo próximo que tenés que hacer vos? ¿Qué ve el peón sin señal? ¿La calma puede tener su propio aspecto?
