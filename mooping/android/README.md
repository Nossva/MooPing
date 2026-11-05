# MooPing para Android

App que abre MooPing en el celular. Es un WebView: muestra la misma web de MooPing, servida desde la PC o el servidor donde corre.

**Descargar la APK:** [release/MooPing.apk](https://github.com/Nossva/MooPing/raw/main/mooping/android/release/MooPing.apk) (Android 7 o más nuevo).

## Instalar
1. Abrí el link desde el celular y descargá `MooPing.apk`.
2. Tocá el archivo descargado. Android te va a pedir permiso para "instalar apps de fuentes desconocidas" desde el navegador o el gestor de archivos: aceptalo.
3. Si aparece Play Protect ("app no reconocida"), tocá **Más detalles → Instalar de todas formas**. Aparece porque la app no está en Play Store.

## Primera vez: elegir el servidor
La app pregunta a qué MooPing conectarse y **recuerda la dirección**:
- **Buscar automáticamente:** revisa la red Wi‑Fi del celular (puertos 5173 y 80) y lista los MooPing que encuentra. Tocás uno y entra.
- **Escribir la dirección:** por ejemplo `192.168.1.50:5173` o `https://mooping.tucampo.com`. Si no ponés puerto, prueba también `:5173`.

Para cambiar de servidor después, mantené apretado el ícono de MooPing y elegí **Cambiar servidor**. Si el servidor no responde, la app vuelve sola a esta pantalla.

## Dejar MooPing accesible desde los celulares (red local)
1. En la PC: Docker Desktop abierto y `python start.py` (o `docker compose up -d`) en la carpeta `mooping`.
2. Celular y PC en la **misma Wi‑Fi**.
3. Abrir el puerto 5173 en el Firewall de Windows. Se hace una sola vez, en una PowerShell **como administrador**:
   ```powershell
   New-NetFirewallRule -DisplayName "MooPing (5173)" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow
   ```
4. La dirección es la IP de la PC (`ipconfig` → "Dirección IPv4") con `:5173`.

Desde fuera de esa red (datos móviles, otra Wi‑Fi), la app necesita un MooPing con dirección pública: un servidor con `docker-compose.prod.yml` y dominio, o un túnel (por ejemplo, Cloudflare Tunnel).

## Qué hace la app además de mostrar la web
- **Alertas:** las notificaciones del navegador (fiebre, fuera del potrero, collar sin señal) salen como notificaciones de Android, con su sonido. Llegan **con la app abierta**: la web es la que consulta las alertas.
- **Fotos:** el botón de foto de los animales abre la cámara o la galería.
- **Enlaces:** WhatsApp, teléfono, mail y sitios externos se abren con su app.
- **Atrás:** el botón atrás navega dentro de MooPing.

## Compilar
```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```
- Necesita un JDK 17 o más nuevo. El SDK de Android, si no está, lo baja solo a `%LOCALAPPDATA%\Android\Sdk`.
- Deja la APK firmada en `release/MooPing.apk`.
- No usa Gradle: `aapt2` → `javac` → `d8` → `zipalign` → `apksigner`.
- Para una versión nueva, subí `versionCode` y `versionName` en `AndroidManifest.xml`.

**Clave de firma:** está en `%USERPROFILE%\.mooping\` (`mooping-release.jks` y su contraseña) y **no va al repo**. Guardá una copia: las actualizaciones tienen que firmarse con la misma clave. Si no, hay que desinstalar la app para instalar la nueva.

## Archivos
| Archivo | Qué es |
|---|---|
| `src/app/mooping/MainActivity.java` | WebView, servidor guardado, búsqueda en la red, notificaciones, fotos y enlaces |
| `assets/setup.html` | Pantalla para elegir el servidor |
| `res/` | Ícono (del logo de MooPing), tema, atajo "Cambiar servidor" y permiso de http en la red local |
| `build.ps1` | Compila y firma |
