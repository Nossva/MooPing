# Plan y Catálogo de Casos de Prueba — MooPing (AgroNomad)

Este documento define los **casos de prueba (CP)** funcionales, de borde y de seguridad para validar todos los requerimientos funcionales especificados en [requerimientos_funcionales.md](./requerimientos_funcionales.md).

---

## 1. Entorno y Datos Base de Prueba

### 1.1. Preparación del Entorno Manual (E2E / UI)
1. Levantar los servicios y cargar el dataset de demostración ("Establecimiento El Ombú"):
   ```bash
   cd mooping
   python start2.py --reset
   ```
2. **Cuentas de prueba preconfiguradas** (contraseña: `mooping123`):
   * **Dueño (`owner`):** `demo@mooping.app`
   * **Personal de campo (`user`):** `maria@mooping.app`
3. **Simulador de alertas en vivo:**
   * Salida de perímetro: `python probar_alerta.py`
   * Fiebre: `python probar_alerta.py fiebre`

### 1.2. Ejecución de Pruebas Automatizadas (Backend + PostGIS)
La suite automatizada en [`tests.py`](../backend/api/tests.py) valida reglas de dominio, ingesta, geocercas y permisos contra PostgreSQL/PostGIS:
```bash
cd mooping
docker compose run --rm backend python manage.py test
```

---

## 2. Catálogo de Casos de Prueba por Módulo

### 2.1. Autenticación, Sesiones y Cuenta Personal (`CP-AUT`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-AUT-01** | RF-AUT-01 | Inicio de sesión exitoso (insensible a mayúsculas en email) | Positivo | Usuario registrado (`demo@mooping.app`) | 1. Ir a `/login` o enviar `POST /api/auth/login/` con `{"email": "DEMO@mooping.app", "password": "mooping123"}`. | Código `200`. Se setea cookie `mooping_session` con flag `HttpOnly`. El JSON devuelve `user` y `organizations` (sin exponer el token en el cuerpo) y redirige a `/`. |
| **CP-AUT-02** | RF-AUT-01 | Inicio de sesión con contraseña incorrecta o email inexistente | Negativo | Sin sesión | 1. Enviar `POST /api/auth/login/` con contraseña errónea. 2. Repetir con email no registrado (`nadie@ejemplo.com`). | En ambos casos responde `401 Unauthorized` con el mismo mensaje `"Email o contraseña incorrectos."` (evita enumeración de usuarios). |
| **CP-AUT-03** | RF-AUT-02 | Bloqueo por exceso de intentos de login (*Rate Limiting*) | Seguridad / Borde | Sin sesión | 1. Realizar 11 intentos fallidos consecutivos de login desde la misma IP en menos de 1 minuto. | Los primeros 10 devuelven `401`; el intento #11 devuelve `429 Too Many Requests` con header `Retry-After` y detalle del tiempo de espera. |
| **CP-AUT-04** | RF-AUT-01 | Rechazo de escritura sin cabecera anti-CSRF | Seguridad | Sesión activa (`Dueño`) | 1. Enviar `POST /api/yards/` con sesión válida pero omitiendo el header `X-Requested-With`. | Responde `403 Forbidden`. |
| **CP-AUT-05** | RF-AUT-03 | Cierre de sesión | Positivo | Sesión activa | 1. Hacer clic en "Cerrar sesión" (`POST /api/auth/logout/`) y luego consultar `GET /api/me/`. | `logout` responde `204 No Content`, borra el token en BD y la posterior consulta a `me/` devuelve `401`. |
| **CP-AUT-06** | RF-AUT-05 | Cambio de contraseña propia y revocación de otras sesiones | Positivo / Seguridad | Usuario con 2 sesiones abiertas (Sesión A en PC y Sesión B en celular) | 1. Desde Sesión A (`/cuenta`), ingresar contraseña actual y nueva contraseña válida (`tranquera-azul-77`). 2. Consultar `GET /api/me/` desde Sesión A y desde Sesión B. | Responde `204`. La Sesión A sigue activa (`200`), mientras que la Sesión B queda invalidada inmediatamente (`401`). |
| **CP-AUT-07** | RF-AUT-05 | Rechazo de contraseña débil al cambiar clave | Negativo | Sesión activa | 1. En `/cuenta`, intentar cambiar la contraseña a `"12345678"`, `"password1"` o menos de 8 caracteres. | El botón de guardado permanece deshabilitado si `< 8` caracteres, o el backend responde `400 Bad Request` detallando la regla incumplida. |

---

### 2.2. Control de Acceso, Roles y Permisos Granulares (`CP-PER`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-PER-01** | RF-PER-01 | Restricción de secciones para rol `Usuario` | Positivo / Seguridad | `Dueño` configura a `maria@mooping.app` solo con secciones `["inicio", "alertas"]` | 1. Iniciar sesión como `maria@mooping.app`. 2. Verificar barra de navegación. 3. Intentar `GET /api/animals/` y `GET /api/devices/`. | El menú solo muestra *Inicio*, *Alertas* y *Soporte*. Los endpoints de secciones no autorizadas (*Monitoreo* y *Equipos*) devuelven `403` (`"No tenés acceso a esta sección."`). |
| **CP-PER-02** | RF-PER-02 | Restricción de alcance por potrero (`all_yards: false`) | Positivo / Seguridad | `Usuario` configurado con `all_yards: false` y `yard_ids: [Potrero Sur]` | 1. Consultar `GET /api/yards/` y `GET /api/animals/`. 2. Intentar consultar por ID un animal ubicado en `Potrero Norte` (`GET /api/animals/{id_norte}/`). | Solo se listan `Potrero Sur` y sus animales. El animal del `Potrero Norte` devuelve `404 Not Found` (como si no existiera), y los collares en stock no son visibles. |
| **CP-PER-03** | RF-PER-02 | Visibilidad de animales sueltos adicionales (`animal_ids`) | Positivo | `Usuario` con `all_yards: false`, `yard_ids: []` y `animal_ids: [Vaca #084]` | 1. Consultar `GET /api/animals/` y `GET /api/alerts/` cuando `Vaca #084` tiene una alerta abierta. | El usuario visualiza únicamente a `Vaca #084`, su collar y sus alertas asociadas. |
| **CP-PER-04** | RF-PER-03 | Bloqueo de escrituras exclusivas del Dueño | Seguridad | Sesión activa como `Usuario` (`maria@mooping.app`) | 1. Verificar que no aparezcan botones de alta/edición en UI (`OwnerOnly`). 2. Enviar `POST /api/yards/`, `PATCH /api/organization/` o `POST /api/devices/`. | Todos los endpoints responden `403 Forbidden` (`"Solo el dueño puede hacer esto."`). |
| **CP-PER-05** | RF-PER-04 | Usuario con membresía suspendida | Negativo / Seguridad | `Dueño` suspende el acceso (`active: false`) de `maria@mooping.app` | 1. Iniciar sesión como `maria@mooping.app`. 2. Intentar consultar `GET /api/alerts/`. | En la UI se renderiza la pantalla `SinAcceso` indicando que no tiene establecimientos activos; la API responde `403`. |
| **CP-PER-06** | RF-PER-02 | Aislamiento entre establecimientos (*Multi-tenant*) | Seguridad | Usuario dueño del establecimiento B ("La Esperanza") | 1. Intentar consultar alertas, animales, potreros o estaciones del establecimiento A ("El Ombú") por su ID. | Responde `404 Not Found` (o lista vacía en colecciones). |

---

### 2.3. Ingesta de Telemetría y Procesamiento (`CP-TEL`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-TEL-01** | RF-TEL-01, RF-TEL-04 | Recepción de lectura válida dentro del potrero | Positivo | `COLLAR-1` asignado a `Vaca #084` en `Potrero Norte` | 1. Enviar `POST /api/telemetry/` (o línea JSON por TCP `:4001`) con `{"ID":"COLLAR-1","LAT":-34.70,"LONG":-58.24,"TEMP":"38.40","GW":"AGROBOT-01"}`. | Responde `201 Created` con `has_position: true` y `alerts_created: []`. Se actualizan `devices.last_seen_at`, `gateways.last_seen_at` y `animal_last_position`. |
| **CP-TEL-02** | RF-TEL-02 | Registro automático de collar desconocido | Positivo | `COLLAR-500` no existe en la base de datos | 1. Enviar lectura con `{"ID":"collar-0500","LAT":-34.70,"LONG":-58.24,"TEMP":38.5,"GW":"AGROBOT-01"}`. | Se normaliza a `COLLAR-500`, se crea en `devices` con `organization_id = NULL`, guarda la lectura y aparece en `GET /api/devices/detected/` para el establecimiento dueño de `AGROBOT-01`. |
| **CP-TEL-03** | RF-TEL-03 | Lectura sin fix GPS (`LAT=0, LONG=0` o `NaN`) | Borde | `COLLAR-1` activo | 1. Enviar `{"ID":"COLLAR-1","LAT":0,"LONG":0,"TEMP":38.5}`. | Responde `201` con `has_position: false`. Se guarda la temperatura y se actualiza `last_seen_at` del collar, sin pisar la última posición válida en `animal_last_position`. |
| **CP-TEL-04** | RF-TEL-03 | Descarte de valores espurios de sensor de temperatura | Borde | `COLLAR-1` activo | 1. Enviar lecturas con `TEMP` en `85`, `127`, `-5` o `Infinity` (errores típicos de sensor DS18B20). | La lectura se acepta pero `temp_body_c` se almacena como `NULL` y no dispara falsas alertas de fiebre. |
| **CP-TEL-05** | RF-TEL-03 | Cálculo automático de velocidad y rumbo derivados | Positivo | Lectura previa hace 60 s en punto A | 1. Enviar nueva lectura en punto B (a 60 m al Este de A) sin campos `SPEED` ni `HEADING`. | El sistema calcula y guarda `speed_mps ≈ 1.0` (`3.6 km/h`) y `heading_deg ≈ 90°` (`Este 90°`). |
| **CP-TEL-06** | RF-TEL-01 | Lote (*Batch*) con una lectura válida y una inválida | Borde | Endpoint `POST /api/telemetry/` | 1. Enviar array JSON `[{"ID":"COLLAR-1","TEMP":38.4}, {"TEMP":38.4}]` (la segunda sin `ID`). | Responde `207 Multi-Status` con `[{"ok": true, ...}, {"ok": false, ...}]`, persistiendo la primera y rechazando la segunda. |
| **CP-TEL-07** | RF-TEL-01 | Rechazo de telemetría sin `TELEMETRY_API_KEY` | Seguridad | `TELEMETRY_API_KEY="secreto"` configurada en backend | 1. Enviar lectura sin header `X-Api-Key` (o sin `"KEY"` por TCP). 2. Repetir enviando la clave correcta. | Sin clave responde `401 Unauthorized` y descarta el paquete; con clave correcta responde `201`. |

---

### 2.4. Motor de Reglas y Gestión de Alertas (`CP-ALE`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-ALE-01** | RF-ALE-01 | Apertura, actualización y cierre automático de alerta `geofence_exit` | Positivo | `Vaca #084` dentro de `Potrero Norte` | 1. Enviar posición 300 m fuera del potrero. 2. Enviar otra posición 500 m fuera. 3. Enviar posición dentro del potrero. | En (1) se crea 1 alerta `geofence_exit` (`critical`, `pending`). En (2) no se duplica la alerta: se actualiza la distancia a ~500 m. En (3) la alerta pasa sola a `resolved` (`resolution: back_inside`). |
| **CP-ALE-02** | RF-ALE-02 | Reevaluación automática de perímetro al editar un potrero | Positivo | `Vaca #084` dentro de `Potrero Norte` sin alertas | 1. Como `Dueño`, editar el polígono de `Potrero Norte` (`PATCH /api/yards/{id}/`) dejando la última posición de `Vaca #084` afuera. 2. Volver a expandir el polígono para incluirla. | En (1) se crea inmediatamente la alerta `geofence_exit` sin esperar nueva lectura del collar. En (2) la alerta se resuelve automáticamente (`resolution: boundary_changed`). |
| **CP-ALE-03** | RF-ALE-03 | Apertura de alerta de fiebre (`fever`) y retención del pico térmico | Positivo | Umbral de fiebre en `39.2 °C` | 1. Enviar lectura con `TEMP: 39.5`. 2. Enviar `TEMP: 40.1`. 3. Enviar `TEMP: 39.6`. | Se crea una única alerta `fever` (`sanitary`) y su `metadata.temp_c` conserva el pico máximo registrado (`40.1 °C`). |
| **CP-ALE-04** | RF-ALE-04 | Apertura periódica y cierre automático de alerta `no_signal` | Positivo | Collar asignado cuya última lectura fue hace `> no_signal_minutes` (30 min) | 1. Ejecutar chequeo periódico (`check_no_signal`). 2. Enviar una nueva lectura del collar. | En (1) se crea una alerta `no_signal` (`equipment`) con la última posición conocida. En (2) la alerta se cierra automáticamente (`resolution: back_online`). |
| **CP-ALE-05** | RF-ALE-05, RF-ALE-06 | Ciclo completo de atención de alerta por Personal de Campo | Positivo | Alerta en estado `pending`; sesión de `Usuario` | 1. Tocar "Tomar a mi cargo" (`PATCH` con `assigned_to: user.id`). 2. Tocar "En curso" (`status: in_progress`). 3. Tocar "Marcar resuelta" (`status: resolved`). | La alerta pasa a `assigned` → `in_progress` → `resolved`, registrando `resolved_by` con el usuario y `resolved_at` con la hora de cierre. |
| **CP-ALE-06** | RF-ALE-06 | Intento de `Usuario` de asignar alerta a otra persona | Negativo / Seguridad | Sesión de `Usuario` (`Beto`) y otro miembro (`Caro`) | 1. Enviar `PATCH /api/alerts/{id}/` con `{"assigned_to": id_de_Caro}`. | Responde `403 Forbidden` (`"Solo el dueño puede asignar alertas a otra persona."`). |
| **CP-ALE-07** | RF-ALE-06 | Intento del `Dueño` de asignar alerta a un usuario sin permiso para verla | Negativo | Miembro `Dani` sin permiso a sección `alertas` (o fuera de su alcance de potreros) | 1. Como `Dueño`, enviar `PATCH /api/alerts/{id}/` con `{"assigned_to": id_de_Dani}`. | Responde `400 Bad Request` (`"Esa persona no tiene permiso para ver esta alerta."`). |
| **CP-ALE-08** | RF-ALE-07 | Cancelación de cambio de estado mediante botón "Deshacer" | Positivo | Alerta abierta en pantalla de Inicio o Alertas | 1. Hacer clic en "Tomar a mi cargo". 2. Antes de que pasen 5 segundos, hacer clic en **"Deshacer"**. | Se cancela el temporizador, no se envía la petición `PATCH` al servidor y la tarjeta vuelve a su estado original. |
| **CP-ALE-09** | RF-ALE-08 | Creación y validación de notas en una alerta | Positivo / Negativo | Alerta abierta | 1. Intentar guardar una nota vacía o solo con espacios (`"   "`). 2. Guardar la nota `"La encontré en el bajo, la llevé al corral"`. | En (1) el botón está deshabilitado en UI y la API devuelve `400`. En (2) devuelve `201 Created` y la nota queda listada con autor y fecha. |

---

### 2.5. Notificaciones y Alarmas Sonoras (`CP-NOT`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-NOT-01** | RF-NOT-01, RF-NOT-02 | Disparo de pitido sonoro y notificación push ante nueva alerta | Positivo | App abierta con alarmas activadas en el navegador y `alarm_sound: true` | 1. Ejecutar `python probar_alerta.py`. 2. Esperar el ciclo de refresco (≤ 15 s). | Suenan los 3 pitidos de `880 Hz` (Web Audio) y aparece la notificación nativa del navegador con el mensaje de la alerta. Al tocarla, lleva a `/alertas`. |
| **CP-NOT-02** | RF-NOT-01, RF-NOT-02 | Silenciado selectivo por tipo de alerta | Positivo | En `/alertas` > *Avisos*, desactivar switch *"Salud (fiebre, actividad)"* (`notify_health: false`) | 1. Ejecutar `python probar_alerta.py fiebre`. 2. Esperar 15 s. | La alerta aparece en la lista de la aplicación, pero **no** suena la alarma ni se emite notificación del navegador. |

---

### 2.6. Tablero de Inicio (`CP-INI`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-INI-01** | RF-INI-01, RF-INI-02 | Priorización de "Asignadas a vos" para rol `Usuario` | Positivo | Sesión de `maria@mooping.app` con 1 alerta asignada a ella y otras pendientes | 1. Ingresar a `/`. | Arriba del listado general se muestra la sección **"Asignadas a vos"** con las alertas a su cargo, sin duplicarlas en **"Resto para atender"**. |
| **CP-INI-02** | RF-INI-04, RF-INI-05 | Visualización de Salud del Rodeo y Resuelto Hoy | Positivo | Datos de demo cargados; resolver 1 alerta en el día | 1. Verificar tarjeta "Salud del rodeo" y sección "Resuelto hoy" en `/`. | Se muestra el porcentaje de animales reportando con su *sparkline* de 7 días, y la alerta recién cerrada aparece en "Resuelto hoy" con el nombre de quien la resolvió. |

---

### 2.7. Monitoreo Geoespacial y Gestión de Potreros (`CP-MON`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-MON-01** | RF-MON-01, RF-MON-03 | Filtrado combinando potrero, estado de perímetro y búsqueda | Positivo | Pantalla `/monitoreo` con datos de demo | 1. Elegir un potrero en el selector. 2. Tocar chip *"Fuera del perímetro"*. 3. Buscar por caravana o lote. | Los parámetros `?yard=`, `geofence=outside` se reflejan en la URL; el mapa encuadra el potrero y muestra los marcadores correspondientes (verde/ámbar/bordó/punteado). |
| **CP-MON-02** | RF-MON-04 | Trazado de recorrido histórico de 24 h | Positivo | Animal seleccionado en `/monitoreo` con lecturas en las últimas 24 h | 1. En la ficha del animal, tocar *"Ver recorrido de las últimas 24 h"*. | Se dibuja en el mapa la polilínea punteada con los nodos de cada punto histórico e informa la cantidad de puntos cargados. |
| **CP-MON-03** | RF-MON-05 | Creación de potrero válido y cálculo de superficie | Positivo | Sesión `Dueño` en `/monitoreo` | 1. Tocar *"Nuevo potrero"*. 2. Marcar 4 puntos en el mapa formando un polígono cerrado sin cruces, ingresar nombre `"Potrero Este"` y guardar. | Responde `201 Created`. El potrero aparece en el selector con su área calculada en hectáreas (`area_ha`). |
| **CP-MON-04** | RF-MON-05 | Rechazo de polígono auto-intersectante ("moño") o con menos de 3 puntos | Negativo / Borde | Sesión `Dueño` en editor de potreros | 1. Marcar 4 puntos cuyos lados se crucen entre sí. 2. Intentar guardar por UI o `POST /api/yards/`. | En la UI se muestra advertencia *"El perímetro se cruza a sí mismo"*, el polígono se dibuja punteado y el botón Guardar se deshabilita. En la API responde `400 Bad Request`. |
| **CP-MON-05** | RF-MON-05 | Rechazo de nombre de potrero duplicado en el mismo establecimiento | Negativo | Potrero `"Potrero Norte"` ya existente | 1. Intentar crear otro potrero llamado `"Potrero Norte"`. | Responde `409 Conflict`. |

---

### 2.8. Gestión de Animales y Ficha Sanitaria (`CP-ANI`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-ANI-01** | RF-ANI-02 | Alta de animal nuevo y validación de caravana única | Positivo / Negativo | Sesión `Dueño` en `/equipos?tab=animales` | 1. Crear animal con nombre `"Vaca #300"` y caravana `"AR-039-300"`. 2. Intentar crear otro animal con la misma caravana `"AR-039-300"`. | El primero se crea (`201`). El segundo falla con `409 Conflict` por unicidad de `(organization_id, tag_number)`. |
| **CP-ANI-02** | RF-ANI-02 | Confirmación al cambiar estado de animal a Vendido o Muerto | Borde | Sesión `Dueño` editando un animal activo | 1. Cambiar estado a `"Vendido"` (`sold`) o `"Muerto"` (`dead`) y tocar Guardar. | La interfaz solicita confirmación explícita advirtiendo que dejará de aparecer en el mapa y listado activo. Al confirmar, se actualiza y sale del monitoreo activo. |
| **CP-ANI-03** | RF-ANI-03 | Subida de foto de animal, validación de tamaño (> 5 MB) y acceso protegido | Positivo / Seguridad | Sesión `Dueño` | 1. Subir imagen JPG de 1 MB. 2. Intentar subir archivo de 6 MB. 3. Intentar abrir `photo_url` sin sesión o desde usuario de otro establecimiento. | (1) Se guarda y muestra la foto. (2) Se rechaza con error de límite de 5 MB. (3) Sin sesión o desde otro establecimiento devuelve `404`. |

---

### 2.9. Gestión de Equipos e Infraestructura (`CP-EQU`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-EQU-01** | RF-EQU-04 | Normalización de formatos al agregar collar y conflicto de duplicados | Positivo / Negativo | Sesión `Dueño` en `/equipos` | 1. Agregar collar ingresando `"84"`, `"084"` o `"C-084"`. 2. Intentar agregar un collar fuera de rango (`"65536"`, `"vaca"`) o ya perteneciente a un establecimiento. | En (1) se normaliza a `COLLAR-84` con etiqueta `C-084` y estado `stock`. En (2) devuelve `400` para formato inválido y `409` si ya tiene dueño. |
| **CP-EQU-02** | RF-EQU-03 | Adopción de collar detectado sin vincular | Positivo | Collar sin dueño transmitió por un gateway del establecimiento en los últimos 7 días | 1. Desplegar el aviso *"Collares detectados sin agregar"* en `/equipos`. 2. Tocar *"Agregar"* sobre el collar detectado y confirmar. | El collar pasa a pertenecer al establecimiento conservando sus lecturas previas. |
| **CP-EQU-03** | RF-EQU-05 | Asignación y desvinculación de collar a un animal | Positivo / Negativo | Collar en `stock` y animal libre | 1. Asignar collar al animal (`POST /api/devices/{id}/assign/`). 2. Intentar asignarle el mismo collar a otro animal sin desvincularlo antes. 3. Desvincular el collar (`unassign`). | (1) Queda vinculado (`200`). (2) Responde `409 Conflict`. (3) Vuelve a estado `stock` y registra `unassigned_at` en el historial. |
| **CP-EQU-04** | RF-EQU-06, RF-EQU-07 | Cambio de intervalo de transmisión y agendamiento de mantenimiento | Positivo / Borde | Sesión `Dueño`; collar activo | 1. Configurar intervalo en `5` s (inválido) y luego en `120` s (válido). 2. Agendar mantenimiento con fecha de ayer (inválido) y con fecha de mañana. | Intervalo `< 10` o `> 3600` devuelve `400`; con `120` actualiza `tx_interval_s` y encola comando `set_interval`. Fecha pasada en mantenimiento devuelve `400`; fecha futura devuelve `201`. |
| **CP-EQU-05** | RF-EQU-08, RF-EQU-09 | Alta, baja de estación AgroBot y listado de collares escuchados (24 h) | Positivo | Sesión `Dueño` en `/equipos?tab=estaciones` | 1. Agregar estación `" agrobot-03 "`. 2. Enviar lecturas por `AGROBOT-03` de un collar propio, uno sin dueño y uno de otro establecimiento. 3. Consultar collares escuchados y luego eliminar la estación. | Se crea normalizada como `AGROBOT-03`. En "collares escuchados" aparecen el propio y el sin dueño (nunca el de otro establecimiento ni lecturas de hace `> 24 h`). Al eliminar la estación (`204`), las lecturas históricas se conservan con `gateway_id = NULL`. |

---

### 2.10. Administración del Establecimiento y Usuarios (`CP-ADM`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-ADM-01** | RF-ADM-02 | Alta de nuevo miembro y duplicado en el mismo establecimiento | Positivo / Negativo | Sesión `Dueño` en `/admin` | 1. Crear usuario con email `"fede@ejemplo.com"` y contraseña válida. 2. Intentar agregar de nuevo `"fede@ejemplo.com"` al mismo establecimiento. | En (1) responde `201` y muestra tarjeta para copiar credenciales. En (2) responde `409 Conflict`. |
| **CP-ADM-02** | RF-ADM-03 | Protección del último dueño activo y prohibición de auto-suspensión | Negativo / Borde | Establecimiento con 1 solo `Dueño` | 1. Intentar cambiar el propio rol a `user`, suspenderse a sí mismo (`active: false`) o eliminarse del establecimiento. | En todos los casos responde `409 Conflict` (en la UI los controles sobre uno mismo están deshabilitados). |
| **CP-ADM-03** | RF-ADM-04 | Blanqueo de contraseña de un miembro por el Dueño | Positivo / Seguridad | Miembro `maria@mooping.app` con sesión activa | 1. Como `Dueño` en `/admin`, cambiar la contraseña de `maria@mooping.app`. 2. Intentar operar desde la sesión previa de María. | Responde `204`, muestra las nuevas credenciales para copiar, y todas las sesiones abiertas de María quedan cerradas (`401`). |
| **CP-ADM-04** | RF-ADM-05 | Edición y validación de umbrales del establecimiento | Positivo / Borde | Sesión `Dueño` en `/admin` > *Establecimiento* | 1. Configurar `fever_threshold_c: 39.5` y `no_signal_minutes: 45`. 2. Intentar guardar `fever_threshold_c: 30` (fuera de `37–42`) o `no_signal_minutes: 2` (fuera de `5–1440`). | En (1) guarda los nuevos umbrales (`200`) que aplican a las siguientes lecturas. En (2) rechaza con `400 Bad Request`. |

---

### 2.11. Soporte Técnico y Diagnóstico Automático (`CP-SOP`)

| ID | RF | Caso de Prueba | Tipo | Rol / Precondición | Pasos / Datos de Entrada | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-SOP-01** | RF-SOP-01, RF-SOP-02 | Envío de reclamo con diagnóstico automático y visualización en historial | Positivo | Cualquier miembro en `/soporte` | 1. Elegir categoría *"Collar"*, escribir mensaje y tocar *"Enviar reclamo"*. | Responde `201 Created`. Se guarda en `support_requests` adjuntando el JSON `diagnostic` del estado actual del sistema y aparece inmediatamente en la lista **"Mis reclamos"**. |
| **CP-SOP-02** | RF-SOP-01 | Límite de envío de reclamos (*Rate Limiting* de soporte) | Borde / Seguridad | Sesión activa en `/soporte` | 1. Enviar 6 reclamos seguidos en menos de 1 hora (`SUPPORT_RATE = 5/hour`). | Los primeros 5 se crean (`201`); el 6.º devuelve `429 Too Many Requests` y muestra `"Enviaste varios reclamos seguidos. Probá de nuevo en un rato."`. |
