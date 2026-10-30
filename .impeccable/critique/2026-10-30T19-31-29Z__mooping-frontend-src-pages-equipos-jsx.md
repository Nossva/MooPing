---
target: Equipos.jsx
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Equipos.jsx"
target_fingerprint: "sha256:a93c19249956d91a6dd2534e1b36798eced7a034ed93d21c71302dd2594cbab2"
target_path: "C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Equipos.jsx"
timestamp: 2026-10-30T19-31-29Z
slug: mooping-frontend-src-pages-equipos-jsx
---
Method: dual-agent (A: revisión de diseño · B: detector). Sin navegador.
Total 23/40 (Aceptable). Nielsen: 2,2,3,2,3,3,2,3,1,2.
Detector: 1 hallazgo side-tab (border-l-4) Equipos.jsx:203; buscador outline-none sin label :96-101.
Prioridades:
- [P0] Refresco fallido borra la pantalla; secciones fallan en silencio, "0" verde en Para revisar (:43-44, :71, :80, :122). harden
- [P1] Jerga: "Fuga", FW, gateway_uid, radio; "Sin asignar"/"En stock" mezclados. clarify
- [P1] Semáforo invertido: gateways "0 de 2" en verde, pill verde con N>0, Check en "Sin posición". clarify/polish
- [P1] Áreas táctiles < 44px (chips, limpiar, py-2). adapt
- [P2] Tienda antes de la lista principal en celular y visible para el Usuario. distill
- [P2] Búsqueda sin debounce ni feedback. harden
