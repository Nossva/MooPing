---
target: Monitoreo.jsx
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Monitoreo.jsx"
target_fingerprint: "sha256:95287bc024000685f67ccf0f4e9abf4312e839f001125ae8234f74f0a6d15c96"
target_path: "C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Monitoreo.jsx"
timestamp: 2026-10-30T19-31-29Z
slug: mooping-frontend-src-pages-monitoreo-jsx
---
Method: dual-agent (A: revisión de diseño · B: detector). Sin navegador (extensión de Chrome desconectada).
Total 22/40 (Aceptable). Nielsen: 2,3,2,2,2,2,2,3,2,2.
Detector: limpio en Monitoreo/HerdMap/YardEditor; grep: text-[10px] Monitoreo.jsx:500, hex en HerdMap/YardEditor (Leaflet), buscador outline-none sin label :155-160, emoji 🐄 :445/:703.
Prioridades:
- [P0] Fallas de datos silenciosas; refresco fallido reemplaza el mapa (Monitoreo.jsx:131, :223, :350, :406). harden
- [P1] Celular: detalle y alertas lejos del mapa. adapt
- [P1] Semáforo roto: "Revisión"/"En alerta" en verde (:260, :375), marcador #b45309, "CRÍTICA" vs "Urgente". polish/clarify
- [P1] Gateway sin señal muestra batería; posiciones viejas iguales a recientes (:105). clarify
- [P2] Áreas táctiles chicas (chips, limpiar, lápiz, py-2, marcadores 22px). adapt
- [P2] "Muerto/Vendido" sin confirmación; Borrar pegado a Cancelar en YardEditor. harden
