---
target: Alertas.jsx
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Alertas.jsx"
target_fingerprint: "sha256:6317046465d62a08657af69e72ba60176cd4cc444ed80aeb8efaadb3042265ca"
target_path: "C:\\Users\\Nossva\\Gits\\MooPing\\mooping\\frontend\\src\\pages\\Alertas.jsx"
timestamp: 2026-10-30T19-31-29Z
slug: mooping-frontend-src-pages-alertas-jsx
---
Method: dual-agent (A: revisión de diseño · B: detector). Sin navegador.
Total 22/40 (Aceptable). Nielsen: 2,3,3,2,1,3,2,2,2,2.
Detector: limpio.
Prioridades:
- [P0] Refresco fallido borra la lista (Alertas.jsx:93-96) y el resumen (:54). harden
- [P1] AlarmToggle y NotificationSettings se pisan el PUT (:158, :196); fallas silenciosas. harden
- [P1] Sección Equipos dice "sin problemas" con N novedades (:113-116). clarify
- [P1] Áreas táctiles chicas: chips py-1.5, toggle, switches 24px sin nombre accesible. adapt
- [P2] Minimapas atrapan el scroll y piden yards/ cada uno (:132-155). distill/adapt
- [P2] Configuración de notificaciones dentro del flujo de alertas. distill
