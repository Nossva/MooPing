# Historias de Usuario — Frontend de MooPing

Este documento recopila todas las **Historias de Usuario (HU)** implementadas en el frontend de **MooPing** ([`mooping/frontend/src`](../frontend/src/App.jsx)), organizadas por épicas según cada pantalla y experiencia transversal, junto con sus **criterios de aceptación**.

### Roles utilizados en las historias
* **Dueño del establecimiento (`owner`):** administra el campo, potreros, rodeo, equipamiento y permisos del personal.
* **Personal de campo (`user`):** recorre el campo (usualmente desde el celular), monitorea lo que tiene asignado y atiende alertas.
* **Miembro del establecimiento (`owner` o `user`):** cualquier persona con acceso activo a la aplicación.

---

## Épica 1: Acceso, Navegación y Experiencia Transversal (`HU-NAV`)
Componentes: [`Login.jsx`](../frontend/src/pages/Login.jsx), [`SinAcceso.jsx`](../frontend/src/pages/SinAcceso.jsx), [`Layout.jsx`](../frontend/src/components/Layout.jsx), [`HeaderMenus.jsx`](../frontend/src/components/HeaderMenus.jsx), [`ui.jsx`](../frontend/src/components/ui.jsx).

### HU-NAV-01 — Inicio de sesión y estado del servidor
> **Como** usuario registrado en MooPing,
> **quiero** ingresar con mi correo y contraseña viendo si el servidor está en línea,
> **para** acceder de forma segura a la telemetría de mi establecimiento.

**Criterios de aceptación:**
* Permite ingresar correo y contraseña con un botón para mostrar/ocultar la clave.
* En pantallas de escritorio, muestra el estado en vivo del servidor y de la base de datos (`En línea` / `Verificando`).
* Si las credenciales fallan o hay bloqueo por intentos, muestra el mensaje de error en pantalla sin recargar la página.

---

### HU-NAV-02 — Aviso de cuenta sin acceso o suspendida
> **Como** usuario cuyo acceso fue suspendido o que aún no fue sumado a ningún establecimiento,
> **quiero** ver una pantalla clara que me explique por qué no puedo entrar y me permita reintentar o cerrar sesión,
> **para** saber que debo pedirle habilitación al dueño del campo.

**Criterios de aceptación:**
* Si `me/` no devuelve establecimientos activos, se muestra la vista [`SinAcceso`](../frontend/src/pages/SinAcceso.jsx) saludando al usuario por su nombre.
* Incluye un botón **"Volver a intentar"** (que vuelve a consultar `me/` sin reloguearse) y un botón **"Cerrar sesión"**.

---

### HU-NAV-03 — Navegación adaptable a escritorio y celular según permisos
> **Como** miembro del establecimiento que usa la app tanto en la PC del escritorio como en el celular en el campo,
> **quiero** contar con un menú lateral en pantallas grandes y una barra inferior táctil en el celular que muestre solo las secciones a las que tengo permiso,
> **para** moverme rápido con una sola mano y sin ver secciones bloqueadas.

**Criterios de aceptación:**
* En escritorio (`md+`) se muestra una barra lateral fija; en móvil se muestra una barra inferior con indicador deslizable (*sliding pill*).
* Solo se muestran las secciones habilitadas para el usuario (`Inicio`, `Monitoreo`, `Alertas`, `Equipos`, y `Admin` solo para el Dueño).
* Si el usuario intenta entrar por URL a una ruta sin permiso, [`Gate`](../frontend/src/App.jsx) lo redirige automáticamente a su primera sección habilitada o a `/cuenta`.
* El ítem **Alertas** muestra un contador numérico (*badge*) con la cantidad de alertas abiertas (refrescado cada 15 s).

---

### HU-NAV-04 — Accesos rápidos en cabecera (Campana de urgencias y Perfil)
> **Como** miembro del establecimiento,
> **quiero** abrir desde cualquier pantalla un resumen de las alertas más urgentes y los datos de mi perfil,
> **para** saltar rápido a una emergencia o ir a mi cuenta, administración o soporte.

**Criterios de aceptación:**
* El botón de **campana** (visible si tiene permiso a Alertas) muestra un punto bordó cuando hay alertas abiertas y despliega hasta las 6 alertas abiertas más urgentes.
* Al tocar una alerta en la campana, si corresponde a un animal y el usuario tiene permiso de `Monitoreo`, navega directo a `/monitoreo?animal={id}`; de lo contrario, va a `/alertas`.
* El botón de **avatar** (con las iniciales del usuario) despliega establecimiento, rol, teléfono, secciones habilitadas y accesos a *Mi cuenta y contraseña*, *Administración* (solo Dueño), *Soporte técnico* y *Cerrar sesión*.
* Ambos paneles se cierran al tocar fuera, presionar `Escape` o navegar.

---

### HU-NAV-05 — Indicador de frescura de datos y tolerancia a cortes de señal
> **Como** trabajador en el campo con señal de internet inestable,
> **quiero** saber hace cuánto se actualizaron los datos en pantalla y seguir viendo la última información cargada aunque falle un refresco,
> **para** no quedarme con la pantalla en blanco ni tomar decisiones con datos viejos sin saberlo.

**Criterios de aceptación:**
* El componente [`Freshness`](../frontend/src/components/ui.jsx) muestra `"Actualizado hace X"` tomando la fuente de datos más antigua de la vista.
* Si un refresco periódico falla pero ya había datos en pantalla, se conservan los datos visibles y el indicador cambia a un botón destacado: `"Sin conexión · datos de hace X · Reintentar"`.

---

## Épica 2: Tablero de Inicio (`HU-INI`)
Componente: [`Inicio.jsx`](../frontend/src/pages/Inicio.jsx).

### HU-INI-01 — Panorama diario de pendientes por urgencia
> **Como** miembro del establecimiento,
> **quiero** ver al abrir la app un cartel resumen con cuántas cosas hay pendientes hoy, cuál es la más urgente y cuántas hay de cada categoría,
> **para** saber por dónde empezar el día en menos de 5 segundos.

**Criterios de aceptación:**
* Muestra fecha actual, nombre del establecimiento, cantidad total de pendientes (o `"Hoy no tenés nada pendiente"`) y el mensaje de la alerta principal (`"Empezá por acá: ..."`).
* Muestra tres contadores (*Urgente*, *Sanitaria*, *Equipos*) destacando en blanco la categoría más urgente con alertas `> 0`.
* Si el usuario tiene acceso a Alertas, cada contador funciona como botón que lleva a `/alertas?category={categoria}`.

---

### HU-INI-02 — Separación de alertas "Asignadas a vos" y "Para atender"
> **Como** personal de campo (`Usuario`),
> **quiero** ver primero las alertas que ya están a mi cargo y debajo el resto de alertas urgentes y sanitarias en formato compacto desplegable,
> **para** enfocarme en mis tareas asignadas sin perder de vista otras urgencias del campo.

**Criterios de aceptación:**
* Para el rol `Usuario`, las alertas donde `assigned_to` coincide con su usuario aparecen arriba bajo **"Asignadas a vos"** y no se repiten abajo.
* En **"Para atender"** (o **"Resto para atender"**), la primera alerta se muestra en tarjeta completa resaltada y las siguientes (hasta 4) se muestran en filas compactas que se abren/cierran en acordeón; si hay más, muestra un enlace `"Ver las otras N en Alertas"`.

---

### HU-INI-03 — Columna de estado del campo (Equipos para revisar, Salud del rodeo, Resuelto hoy y Equipo)
> **Como** miembro del establecimiento,
> **quiero** ver en Inicio qué collares necesitan revisión, el porcentaje de salud del rodeo en los últimos 7 días y qué alertas ya se resolvieron hoy,
> **para** tener control del estado general del establecimiento en una sola vista.

**Criterios de aceptación:**
* Lista las tarjetas de **Equipos para revisar** (collares sin señal o en alerta), permitiendo al Dueño pedir señal al collar (`Enviar ping`) desde allí mismo.
* Muestra la tarjeta **Salud del rodeo** con el porcentaje de animales reportando, indicador *"sin novedades"* (≥ 95%) o *"revisar"*, y gráfico *sparkline* de los últimos 7 días.
* Muestra un bloque plegable **"Resuelto hoy"** con las alertas cerradas en el día, potrero, quién las resolvió y hace cuánto.
* Si el usuario es `Dueño`, muestra además la tarjeta **"Tu equipo"** con cantidad de usuarios activos, dueños y suspendidos, enlazada a `/admin`.

---

## Épica 3: Monitoreo Geoespacial, Potreros y Ficha del Animal (`HU-MON`)
Componentes: [`Monitoreo.jsx`](../frontend/src/pages/Monitoreo.jsx), [`HerdMap.jsx`](../frontend/src/components/HerdMap.jsx), [`BaseLayers.jsx`](../frontend/src/components/BaseLayers.jsx), [`YardEditor.jsx`](../frontend/src/components/YardEditor.jsx), [`AnimalForm.jsx`](../frontend/src/components/AnimalForm.jsx).

### HU-MON-01 — Mapa en vivo del rodeo con capas de calles y relieve
> **Como** miembro del establecimiento,
> **quiero** ver en un mapa interactivo el perímetro de los potreros y la ubicación de cada animal diferenciada por colores y alternar entre mapa de calles y relieve topográfico,
> **para** ubicar rápido en el terreno a los animales fuera del potrero, con alerta o sin señal.

**Criterios de aceptación:**
* Dibuja los polígonos de los potreros y los marcadores de cada animal según su estado: **Bien** (verde), **Alerta** (ámbar), **Fuera** (bordó con animación de pulso y etiqueta `"FUERA"`) y **Sin señal** (> 30 min sin datos, borde punteado semitransparente).
* Incluye leyenda superpuesta con el porcentaje del rodeo dentro del perímetro.
* Incluye un botón en la esquina superior derecha del mapa para alternar entre **Mapa** (*OpenStreetMap*) y **Relieve** (*Esri World Topo*), guardando la elección en `localStorage`.
* Al elegir otro animal, el mapa vuela suavemente (`flyTo`) hacia su posición y en pantallas móviles desplaza la vista hasta su ficha.

---

### HU-MON-02 — Selector de potrero, buscador y filtros sincronizados en URL
> **Como** miembro del establecimiento,
> **quiero** filtrar el mapa y el listado de animales por potrero, por si están dentro o fuera del perímetro, o buscando por caravana, collar o lote,
> **para** encontrar un animal específico o compartir el enlace directo de esa vista.

**Criterios de aceptación:**
* El selector desplegable (`YardPicker`) permite elegir *"Todos los potreros"* o un potrero puntual mostrando sus hectáreas y cantidad de animales.
* Muestra 3 indicadores superiores: **Rodeo** (`con posición / total`), **Alertas** (`activas`) y **Estación AgroBot** (`En línea Solar/Red` o `Sin señal`).
* Debajo del mapa incluye buscador por texto y chips de filtro (*Todos*, *Dentro del perímetro*, *Fuera del perímetro*) con contadores y paginación (*"Ver más animales"*).
* El potrero (`?yard=`), filtro (`?geofence=`) y animal seleccionado (`?animal=`) se mantienen en la URL.

---

### HU-MON-03 — Consulta de ficha biométrica y recorrido de 24 horas
> **Como** miembro del establecimiento,
> **quiero** ver la ficha detallada del animal seleccionado (temperatura interna con su rango, distancia caminada/rumia/velocidad, coordenadas DMS y estado del collar) y dibujar su recorrido de las últimas 24 horas en el mapa,
> **para** evaluar su estado de salud y ver por dónde se estuvo moviendo.

**Criterios de aceptación:**
* Muestra foto (o ícono sin foto), nombre, raza, caravana, lote, estado de perímetro (con metros afuera si salió) y estado de alertas.
* Muestra 4 mosaicos: **Temp. interna** (con barra de progreso y aviso *Rango normal* / *Fuera de rango*), **Actividad hoy** (km caminados y rumia o velocidad/rumbo), **Posicionamiento** (coordenadas en grados, minutos y segundos N/S E/O y antigüedad) y **Collar** (último dato e intervalo de envío).
* El botón **"Ver recorrido de las últimas 24 h"** (y **"Ocultar recorrido"**) traza en el mapa la polilínea y los puntos históricos del animal e informa cuántos puntos se cargaron.

---

### HU-MON-04 — Edición de datos del animal, foto y ficha sanitaria (Solo Dueño)
> **Como** Dueño del establecimiento,
> **quiero** editar los datos de un animal, subir o quitar su foto y anotar observaciones en su ficha sanitaria desde Monitoreo,
> **para** mantener actualizado el registro clínico y de identificación de cada cabeza de ganado.

**Criterios de aceptación:**
* El botón de lápiz abre [`AnimalForm`](../frontend/src/components/AnimalForm.jsx) permitiendo editar nombre, caravana, lote, raza, sexo, fecha de nacimiento, potrero y estado (*Activo*, *Inactivo*, *Vendido*, *Muerto*), así como subir/cambiar/quitar foto (JPG, PNG, WEBP, GIF hasta 5 MB con vista previa).
* Si se cambia el estado a *Vendido* o *Muerto*, pide confirmación antes de guardar advirtiendo que el animal dejará de aparecer en el mapa y listado del rodeo.
* El botón **"Ficha sanitaria"** abre un área de texto para registrar o actualizar vacunas, tratamientos y observaciones (`notes`).

---

### HU-MON-05 — Creación, edición en mapa y borrado de potreros (Solo Dueño)
> **Como** Dueño del establecimiento,
> **quiero** crear o editar un potrero dibujando sus esquinas directamente sobre el mapa (viendo dónde están las vacas como referencia) o borrarlo,
> **para** definir y ajustar las geocercas del campo sin usar herramientas externas.

**Criterios de aceptación:**
* Los botones **"Nuevo potrero"** y **"Editar"** reemplazan el mapa por el editor [`YardEditor`](../frontend/src/components/YardEditor.jsx) conservando el centro y zoom actuales.
* Muestra como referencia no interactiva los demás potreros y los puntos de posición de los animales.
* Permite tocar el mapa para agregar vértices, arrastrar vértices existentes para corregirlos, **"Deshacer"** el último punto y **"Limpiar"** todo.
* Valida que haya al menos 3 puntos y detecta en vivo si el polígono se cruza a sí mismo (`selfIntersects`), mostrando una alerta y deshabilitando el guardado hasta corregirlo.
* Pide confirmación en línea tanto para **borrar el potrero** como para **cancelar si hay cambios sin guardar**.

---

## Épica 4: Centro de Alertas, Atención y Alarmas (`HU-ALE`)
Componentes: [`Alertas.jsx`](../frontend/src/pages/Alertas.jsx), [`AlertCard.jsx`](../frontend/src/components/AlertCard.jsx), [`useAlertWatcher.js`](../frontend/src/api/useAlertWatcher.js).

### HU-ALE-01 — Visualización y filtrado en el Centro de Alertas
> **Como** miembro del establecimiento con acceso a Alertas,
> **quiero** ver todas las alertas abiertas separadas entre "Atención inmediata" y "Equipos", filtrarlas por categoría y ver un minimapa en las salidas de perímetro,
> **para** priorizar las emergencias críticas y localizar rápido al animal escapado.

**Criterios de aceptación:**
* Muestra un encabezado con la cantidad de alertas urgentes sin atender, antigüedad del último dato del campo y estado del enlace LoRa (`LoRa OK` / `LoRa sin datos`).
* Permite filtrar mediante chips con contadores: *Todas*, *Urgentes*, *Sanitarias*, *Equipos*.
* En escritorio, si una sección tiene hasta 3 alertas se muestran en tarjetas anchas a fila completa; si tiene más de 3, pasa a una grilla compacta de 2 o 3 columnas.
* Las alertas de tipo `geofence_exit` con posición incluyen un minimapa con el potrero, el marcador del animal y sus coordenadas.

---

### HU-ALE-02 — Flujo de atención de una alerta con opción "Deshacer" y notas
> **Como** miembro del establecimiento,
> **quiero** tomar una alerta a mi cargo, avanzar su estado (*Asignada* → *En curso* → *Resuelta*), poder deshacer el cambio si toqué sin querer y agregar notas de campo,
> **para** coordinar con el equipo quién atiende cada incidente y dejar registro de qué se hizo.

**Criterios de aceptación:**
* Cada [`AlertCard`](../frontend/src/components/AlertCard.jsx) muestra una barra visual de 4 pasos (*Pendiente*, *Asignada*, *En curso*, *Resuelta*) y el nombre del responsable asignado.
* Al tocar el botón para asignarse o avanzar el estado, el cambio entra en una cola de 5 segundos mostrando una barra de cuenta regresiva con el botón **"Deshacer"** antes de enviarse al servidor.
* Permite abrir un cuadro de texto para escribir y guardar una nota en la alerta, o navegar a *"Ubicar en GPS"* / *"Ver ficha"* en Monitoreo.

---

### HU-ALE-03 — Activación de alarmas sonoras y configuración de avisos
> **Como** miembro del establecimiento,
> **quiero** activar o silenciar la alarma sonora y elegir de qué tipos de alerta (*Perímetro*, *Salud*, *Equipos*) y por qué canales (*Push*, *Email*, *SMS*) quiero recibir avisos,
> **para** que el celular o la PC me avisen con sonido y notificación aunque esté mirando otra pestaña.

**Criterios de aceptación:**
* Si las alarmas aún no fueron habilitadas en el navegador actual, aparece un banner superior invitando a **"Activar alarmas"** (que desbloquea Web Audio y solicita permiso de notificaciones del navegador); si el navegador tiene bloqueado el permiso, explica cómo habilitarlo desde el candado de la barra de direcciones.
* En `/alertas`, un botón permite alternar entre **"Alarma activa"** y **"Alarma silenciada"**, y el botón **"Avisos"** despliega un panel en acordeón con interruptores (*switches*) independientes para cada tipo de alerta y canal.
* Cuando [`useAlertWatcher`](../frontend/src/api/useAlertWatcher.js) detecta una alerta nueva habilitada en las preferencias del usuario, emite 3 pitidos y dispara una notificación nativa que al tocarla abre `/alertas`.

---

## Épica 5: Gestión de Equipos, Animales y Red (`HU-EQU`)
Componentes: [`Equipos.jsx`](../frontend/src/pages/Equipos.jsx), [`DeviceAttentionCard.jsx`](../frontend/src/components/DeviceAttentionCard.jsx).

### HU-EQU-01 — Panel de estado de infraestructura y collares para revisar
> **Como** miembro del establecimiento con acceso a Equipos,
> **quiero** ver el resumen de collares activos, estaciones y repetidores en línea, junto con los collares que requieren atención inmediata,
> **para** verificar de un vistazo la salud técnica de la red LoRa del campo.

**Criterios de aceptación:**
* Muestra estado de conexión al servidor y tres tarjetas interactivas (*Collares*, *Estaciones*, *Repetidores*) que al tocarlas abren la pestaña correspondiente del inventario.
* Si hay collares con problemas, los destaca arriba en la sección **"Para revisar"**; si todos funcionan bien, muestra un aviso verde *"Todo en orden: ningún collar necesita atención"*.

---

### HU-EQU-02 — Inventario de collares, búsqueda y filtros por estado
> **Como** miembro del establecimiento,
> **quiero** buscar collares por caravana, número de collar o lote y filtrarlos por estado (*Todos*, *En alerta*, *Sin señal*, *En stock*),
> **para** encontrar rápido un collar y conocer cuándo transmitió por última vez y a qué animal está asignado.

**Criterios de aceptación:**
* Incluye buscador con *debounce* de 300 ms, chips de filtro con contadores y paginación (*"Ver más collares"*).
* Cada tarjeta de collar muestra su etiqueta, estado (*Óptimo*, *Fuera del perímetro*, *Sin señal*, *En stock*), animal vinculado (o ubicación de guardado si está en stock), antigüedad del último dato, intervalo de transmisión y botón **"Localizar"** (si está en alerta o sin señal).
* Para el Dueño, al pie de la pestaña se muestra la tarjeta informativa de tienda para adquirir collares adicionales (`StoreCard`).

---

### HU-EQU-03 — Alta manual de collares y adopción de collares detectados (Solo Dueño)
> **Como** Dueño del establecimiento,
> **quiero** agregar un collar escribiendo su número grabado o eligiéndolo de la lista de collares detectados automáticamente por mis estaciones,
> **para** incorporar collares nuevos al stock del establecimiento sin configuraciones técnicas complejas.

**Criterios de aceptación:**
* Si las estaciones del campo escucharon collares sin dueño en los últimos 7 días, se muestra una banda desplegable **"N collares detectados sin agregar"** con botón **"Agregar"** que precarga el número del collar.
* El formulario **"Agregar collar"** acepta el número en cualquier formato (de `0` a `65535`), muestra cómo se normalizará (`COLLAR-84`) y sugiere la etiqueta por defecto (`C-084`).

---

### HU-EQU-04 — Vinculación a un animal, desvinculación y configuración de intervalo (Solo Dueño)
> **Como** Dueño del establecimiento,
> **quiero** ponerle un collar en stock a un animal libre, desvincularlo cuando se lo saco o cambiar cada cuántos segundos manda datos,
> **para** reflejar en el sistema qué animal lleva cada collar y administrar el consumo/frecuencia de envío.

**Criterios de aceptación:**
* En un collar *En stock*, el botón **"Ponérselo a un animal"** despliega un selector con los animales que no tienen collar activo (o avisa si todos tienen collar).
* En un collar asignado, el botón **"Configurar"** permite modificar el intervalo de transmisión (`10` a `3600` segundos) y ofrece el botón **"Desvincular de {animal}"** con un cuadro de confirmación previo advirtiendo que el animal dejará de tener rastreo.

---

### HU-EQU-05 — Listado y alta de animales desde Equipos (Solo Dueño / Miembro)
> **Como** Dueño del establecimiento,
> **quiero** contar con una pestaña de "Animales" dentro de Equipos donde pueda buscarlos, ver cuáles no tienen collar y dar de alta animales nuevos,
> **para** cargar nuevos animales y enseguida asignarles un collar sin cambiar de sección.

**Criterios de aceptación:**
* La pestaña **Animales** lista los animales con buscador, indicando con una píldora cuáles están *"Sin collar"*, y al tocar una fila abre su ficha en `/monitoreo?animal={id}`.
* Para el Dueño, el botón **"Agregar animal"** despliega [`AnimalForm`](../frontend/src/components/AnimalForm.jsx) y al guardar muestra un aviso confirmando que ya se le puede asignar un collar.

---

### HU-EQU-06 — Gestión de estaciones AgroBot, repetidores y collares escuchados
> **Como** Dueño del establecimiento (y miembro para consulta),
> **quiero** ver las estaciones y repetidores con los collares que escucharon en las últimas 24 h, y poder agregar, editar o quitar estaciones,
> **para** administrar las Raspberry Pi receptoras del campo y verificar su alcance real.

**Criterios de aceptación:**
* Cada tarjeta de estación muestra nombre, tipo (*Estación AgroBot* o *Repetidor*), alimentación (*solar* / *a red*), estado (*Conectado* / *Desconectado*), cobertura en ha, último dato y un desplegable **"N collares escuchados en las últimas 24 h"** (indicando animal o si es un collar detectado sin dueño).
* Para el Dueño, permite **"Agregar estación"** (ingresando el `GATEWAY_ID` de la Raspberry Pi), **"Editar"** sus datos o **"Quitar"** la estación con confirmación previa.

---

## Épica 6: Administración de Usuarios y del Establecimiento (`HU-ADM`)
Componente: [`Administracion.jsx`](../frontend/src/pages/Administracion.jsx) (exclusivo rol `Dueño`).

### HU-ADM-01 — Panel de usuarios, alta de miembros y entrega de credenciales
> **Como** Dueño del establecimiento,
> **quiero** ver y filtrar las personas con acceso a mi campo y dar de alta nuevos dueños o usuarios generando una contraseña segura lista para copiar,
> **para** sumar personal al sistema y pasarles sus datos de ingreso por WhatsApp o en mano.

**Criterios de aceptación:**
* Muestra contadores de miembros *Con acceso*, *Dueños*, *Usuarios* y *Suspendidos*, buscador por nombre/email, filtros y una tabla guía lateral (*"Qué puede cada rol"*).
* El diálogo **"Nuevo usuario"** permite elegir rol (*Usuario* o *Dueño*), cargar nombre, email, teléfono y contraseña (con botón de varita mágica para generar una clave aleatoria de 10 caracteres).
* Al crear el usuario, muestra un bloque con la URL de MooPing, el email y la contraseña y un botón **"Copiar"** al portapapeles.

---

### HU-ADM-02 — Configuración granular de permisos por sección, potrero y animal
> **Como** Dueño del establecimiento,
> **quiero** elegir para cada empleado (`Usuario`) qué secciones de la app puede ver y si ve todos los potreros o solo algunos potreros y animales puntuales,
> **para** que cada trabajador vea únicamente el sector del campo que le corresponde.

**Criterios de aceptación:**
* En la fila de cada miembro con rol `Usuario`, se muestra un resumen de su alcance actual y el botón **"Permisos"**.
* El diálogo de permisos permite marcar/desmarcar las secciones (*Inicio*, *Monitoreo*, *Alertas*, *Equipos* — exigiendo al menos una) y elegir entre *"Todos los potreros"* o *"Solo algunos"* (habilitando checkboxes por potrero y un buscador para seleccionar animales sueltos adicionales).
* Antes de guardar, muestra una frase resumen indicando exactamente cuántos animales y en qué secciones los verá esa persona.

---

### HU-ADM-03 — Cambio de rol, suspensión, blanqueo de clave y baja de miembros
> **Como** Dueño del establecimiento,
> **quiero** cambiar el rol de un miembro, suspender o reactivar su acceso temporalmente, blanquearle la contraseña si se la olvidó o quitarlo del establecimiento,
> **para** mantener el control de seguridad del establecimiento cuando cambia el personal.

**Criterios de aceptación:**
* Cada tarjeta de miembro incluye un selector de rol (*Dueño* / *Usuario*), un interruptor de **Acceso activo / Sin acceso**, un botón de llave para blanquearle la contraseña (cerrando sus sesiones activas y dando las credenciales nuevas para copiar) y un botón de papelera con confirmación para quitarlo.
* Los controles para degradar rol o suspender acceso están deshabilitados sobre la fila del propio usuario (`Vos`) para evitar quedarse sin acceso por accidente.

---

### HU-ADM-04 — Configuración del establecimiento y umbrales de alerta
> **Como** Dueño del establecimiento,
> **quiero** editar el nombre del establecimiento, el teléfono del veterinario, la temperatura a partir de la cual se considera fiebre y los minutos para declarar un collar sin señal,
> **para** adaptar las reglas automáticas de alertas a las condiciones reales de mi rodeo y mi campo.

**Criterios de aceptación:**
* En la pestaña **Establecimiento** de `/admin`, permite editar y guardar el nombre, teléfono del veterinario, umbral de fiebre (`37` a `42 °C`, paso `0.1`) y minutos sin señal (`5` a `1440` min), mostrando confirmación visual (`"Guardado"`).

---

## Épica 7: Cuenta Personal y Soporte Técnico (`HU-CTA` y `HU-SOP`)
Componentes: [`MiCuenta.jsx`](../frontend/src/pages/MiCuenta.jsx), [`Soporte.jsx`](../frontend/src/pages/Soporte.jsx).

### HU-CTA-01 — Consulta de datos personales y cambio de contraseña propia
> **Como** miembro del establecimiento,
> **quiero** ver los datos de mi cuenta y cambiar mi contraseña actual validando que tenga al menos 8 caracteres y coincida al repetirla,
> **para** mantener segura mi cuenta y cerrar sesiones que hayan quedado abiertas en otros dispositivos.

**Criterios de aceptación:**
* Muestra tarjeta con iniciales, nombre, email, teléfono, nombre del establecimiento y rol.
* El formulario de cambio de contraseña valida en vivo longitud mínima (8 caracteres) y coincidencia entre ambos campos antes de habilitar **"Guardar contraseña"**, e informa que se cerrarán las sesiones en otros dispositivos.

---

### HU-SOP-01 — Envío de reclamos con diagnóstico automático, historial y FAQ
> **Como** miembro del establecimiento que tiene un problema en el campo,
> **quiero** enviar un reclamo técnico que adjunte solo el diagnóstico del sistema, ver el estado de mis reclamos anteriores y consultar preguntas frecuentes o contactos de urgencia,
> **para** resolver problemas rápido sin tener que explicar detalles técnicos de los gateways o collares.

**Criterios de aceptación:**
* En `/soporte`, el formulario preselecciona automáticamente la categoría `"Collar"` si el diagnóstico detecta equipos o enlaces caídos (o `"App / cuenta"` si todo está en línea).
* Al enviar el reclamo, se adjunta en segundo plano el diagnóstico del establecimiento y el reclamo se incorpora a la tarjeta **"Mis reclamos"** indicando si fue enviado por email.
* Muestra enlaces directos de contacto urgente (**WhatsApp**, **teléfono** y **horario** si están configurados) y un bloque de **Preguntas frecuentes** desplegables con pasos concretos de resolución.
