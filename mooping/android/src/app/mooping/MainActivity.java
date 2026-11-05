package app.mooping;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * MooPing para Android: un WebView que abre el servidor de MooPing que elija el usuario.
 * La dirección se guarda; la pantalla de configuración (assets/setup.html) permite
 * escribirla a mano o buscar servidores en la misma Wi-Fi.
 */
public class MainActivity extends Activity {
    private static final String SETUP_URL = "file:///android_asset/setup.html";
    private static final String PREFS = "mooping";
    private static final int REQ_FILE = 9;
    private static final int REQ_NOTIF = 7;
    private static final int[] SCAN_PORTS = {5173, 80};
    private static final String CHANNEL = "alertas";

    // Reemplazo de window.Notification (el WebView no lo trae): las alertas de MooPing
    // salen como notificaciones de Android.
    private static final String NOTIFICATION_SHIM =
        "<script>(function(){if(window.Notification||!window.MooPingApp)return;"
        + "function N(t,o){o=o||{};try{MooPingApp.notify(String(t),String(o.body||''),String(o.tag||''))}catch(e){}"
        + "this.title=t;this.body=o.body;this.tag=o.tag;this.onclick=null}"
        + "N.prototype.close=function(){};N.prototype.addEventListener=function(){};"
        + "Object.defineProperty(N,'permission',{get:function(){return MooPingApp.notifyPermission()}});"
        + "N.requestPermission=function(cb){return new Promise(function(r){window.__mpPermCb=function(s){if(cb)cb(s);r(s)};MooPingApp.requestNotifyPermission()})};"
        + "window.Notification=N})();</script>";

    private WebView web;
    private SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private ValueCallback<Uri[]> fileCallback;
    private volatile boolean onSetupPage = false;
    private volatile String setupError = "";
    private volatile ExecutorService scanPool;
    private int notifId = 1;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#670626"));
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#FBF8F6"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // Android 15 dibuja de borde a borde: dejamos lugar para la barra de estado, la de navegación y el teclado.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int l, t, r, b;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                l = i.left; t = i.top; r = i.right; b = i.bottom;
            } else {
                l = insets.getSystemWindowInsetLeft(); t = insets.getSystemWindowInsetTop();
                r = insets.getSystemWindowInsetRight(); b = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(l, t, r, b);
            return insets;
        });
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " MooPingApp/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "MooPingApp");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        createChannel();
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        boolean setup = intent != null && "app.mooping.SETUP".equals(intent.getAction());
        String server = prefs.getString("server", "");
        if (setup || server.isEmpty()) showSetup("");
        else if (!(web.getUrl() != null && web.getUrl().startsWith(server))) openServer(server);
    }

    // ---------- Navegación ----------

    private void showSetup(String error) {
        setupError = error == null ? "" : error;
        onSetupPage = true;
        web.loadUrl(SETUP_URL);
    }

    /** Verifica el servidor y lo abre; si no responde, vuelve a la configuración con el error. */
    private void openServer(String server) {
        new Thread(() -> {
            boolean ok = isMooPing(server, 3000);
            ui.post(() -> {
                if (ok) { onSetupPage = false; web.loadUrl(server); }
                else showSetup("No se pudo conectar con " + server + ". ¿Está prendido MooPing y estás en la misma red?");
            });
        }).start();
    }

    private String host(String url) {
        try { return Uri.parse(url).getAuthority(); } catch (Exception e) { return null; }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            String scheme = u.getScheme() == null ? "" : u.getScheme();
            if (scheme.equals("file")) return false;
            String server = prefs.getString("server", "");
            if ((scheme.equals("http") || scheme.equals("https")) && u.getAuthority() != null && u.getAuthority().equals(host(server))) return false;
            // WhatsApp, teléfono, mail y sitios externos: fuera de la app.
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            // Inyecta el reemplazo de Notification en el HTML de MooPing, antes de que corra la app.
            if (!req.isForMainFrame() || !"GET".equals(req.getMethod())) return null;
            String url = req.getUrl().toString();
            String server = prefs.getString("server", "");
            if (server.isEmpty() || !url.startsWith(server)) return null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(8000); c.setReadTimeout(15000);
                for (Map.Entry<String, String> h : req.getRequestHeaders().entrySet()) c.setRequestProperty(h.getKey(), h.getValue());
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) c.setRequestProperty("Cookie", cookie);
                int code = c.getResponseCode();
                String type = c.getContentType();
                if (code != 200 || type == null || !type.startsWith("text/html")) { c.disconnect(); return null; }
                String html = new String(readAll(c.getInputStream(), 4 << 20), StandardCharsets.UTF_8);
                int i = html.indexOf("<head>");
                html = i >= 0 ? html.substring(0, i + 6) + NOTIFICATION_SHIM + html.substring(i + 6) : NOTIFICATION_SHIM + html;
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                return new WebResourceResponse("text/html", "utf-8", 200, "OK", headers, new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
            } catch (Exception e) {
                return null; // que lo cargue el WebView y, si falla, onReceivedError muestra la configuración
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
            if (req.isForMainFrame() && !req.getUrl().toString().startsWith("file:")) {
                showSetup("Se cortó la conexión con " + prefs.getString("server", "") + " (" + err.getDescription() + ").");
            }
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            onSetupPage = url != null && url.startsWith(SETUP_URL);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            CookieManager.getInstance().flush();
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = cb;
            try {
                startActivityForResult(params.createIntent(), REQ_FILE);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack() && !onSetupPage) web.goBack();
        else if (onSetupPage && !prefs.getString("server", "").isEmpty() && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    // ---------- Red ----------

    private static byte[] readAll(InputStream in, int max) throws java.io.IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0 && out.size() < max) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    /** true si en esa dirección responde la API de MooPing (/api/health/). */
    static boolean isMooPing(String base, int timeoutMs) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(base + "/api/health/").openConnection();
            c.setConnectTimeout(timeoutMs);
            c.setReadTimeout(timeoutMs * 2);
            c.setInstanceFollowRedirects(true);
            if (c.getResponseCode() != 200) return false;
            String body = new String(readAll(c.getInputStream(), 4096), StandardCharsets.UTF_8);
            return body.contains("\"status\"");
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** Lo que escribió el usuario → direcciones posibles, en orden. "192.168.1.50" prueba también :5173. */
    static List<String> candidates(String raw) {
        List<String> out = new ArrayList<>();
        String s = raw == null ? "" : raw.trim();
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        if (s.isEmpty()) return out;
        boolean hasScheme = s.startsWith("http://") || s.startsWith("https://");
        String base = hasScheme ? s : "http://" + s;
        Uri u = Uri.parse(base);
        String path = u.getPath() == null ? "" : u.getPath();
        String origin = u.getScheme() + "://" + u.getAuthority();
        out.add(origin + path);
        if (u.getPort() == -1 && !hasScheme) {
            out.add("http://" + u.getHost() + ":5173" + path);
            out.add("https://" + u.getHost() + path);
        }
        return out;
    }

    private static List<String> localIPv4() {
        List<String> ips = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) {
                        String ip = a.getHostAddress();
                        if (ni.getName().startsWith("wlan")) ips.add(0, ip); else ips.add(ip);
                    }
                }
            }
        } catch (Exception ignored) { }
        return ips;
    }

    private void js(String code) {
        ui.post(() -> web.evaluateJavascript(code, null));
    }

    private static String q(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    private void remember(String server) {
        List<String> recent = recent();
        recent.remove(server);
        recent.add(0, server);
        while (recent.size() > 5) recent.remove(recent.size() - 1);
        prefs.edit().putString("server", server).putString("recent", String.join("\n", recent)).apply();
    }

    private List<String> recent() {
        List<String> r = new ArrayList<>();
        for (String x : prefs.getString("recent", "").split("\n")) if (!x.isEmpty()) r.add(x);
        return r;
    }

    // ---------- Notificaciones ----------

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Alertas de MooPing", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Animales fuera del potrero, fiebre, collares sin señal");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    private String notifPermission() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return "granted";
            return prefs.getBoolean("notifAsked", false) ? "denied" : "default";
        }
        return nm.areNotificationsEnabled() ? "granted" : "denied";
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == REQ_NOTIF) js("window.__mpPermCb&&window.__mpPermCb(" + q(notifPermission()) + ")");
    }

    // ---------- Puente con JavaScript ----------

    private class Bridge {
        // Solo la pantalla de configuración (archivo local) puede cambiar de servidor o escanear.
        private boolean trusted() { return onSetupPage; }

        @JavascriptInterface
        public String getState() {
            try {
                JSONObject o = new JSONObject();
                o.put("server", prefs.getString("server", ""));
                o.put("recent", new JSONArray(recent()));
                o.put("error", setupError);
                o.put("ips", new JSONArray(localIPv4()));
                return o.toString();
            } catch (Exception e) {
                return "{}";
            }
        }

        /** Prueba lo que escribió el usuario; responde con window.onTestResult(ok, direccion). */
        @JavascriptInterface
        public void test(String raw) {
            if (!trusted()) return;
            new Thread(() -> {
                for (String c : candidates(raw)) {
                    if (isMooPing(c, 2500)) { js("window.onTestResult(true," + q(c) + ")"); return; }
                }
                js("window.onTestResult(false," + q(raw) + ")");
            }).start();
        }

        @JavascriptInterface
        public void connect(String server) {
            if (!trusted()) return;
            remember(server);
            ui.post(() -> { setupError = ""; onSetupPage = false; web.clearHistory(); web.loadUrl(server); });
        }

        @JavascriptInterface
        public void forget(String server) {
            if (!trusted()) return;
            List<String> r = recent();
            r.remove(server);
            SharedPreferences.Editor e = prefs.edit().putString("recent", String.join("\n", r));
            if (server.equals(prefs.getString("server", ""))) e.remove("server");
            e.apply();
        }

        /** Busca MooPing en la red del celular (/24, puertos 5173 y 80). */
        @JavascriptInterface
        public void scan() {
            if (!trusted()) return;
            if (scanPool != null) scanPool.shutdownNow();
            List<String> ips = localIPv4();
            if (ips.isEmpty()) { js("window.onScanDone(0,'')"); return; }
            String ip = ips.get(0);
            String prefix = ip.substring(0, ip.lastIndexOf('.') + 1);
            ExecutorService pool = Executors.newFixedThreadPool(64);
            scanPool = pool;
            int total = 254 * SCAN_PORTS.length;
            AtomicInteger done = new AtomicInteger(), found = new AtomicInteger();
            for (int port : SCAN_PORTS) {
                for (int h = 1; h <= 254; h++) {
                    String base = "http://" + prefix + h + (port == 80 ? "" : ":" + port);
                    pool.execute(() -> {
                        if (isMooPing(base, 500)) { found.incrementAndGet(); js("window.onScanFound(" + q(base) + ")"); }
                        int d = done.incrementAndGet();
                        if (d % 20 == 0) js("window.onScanProgress(" + d + "," + total + ")");
                    });
                }
            }
            pool.shutdown();
            new Thread(() -> {
                try { pool.awaitTermination(60, TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
                if (scanPool == pool) js("window.onScanDone(" + found.get() + "," + q(prefix + "x") + ")");
            }).start();
        }

        @JavascriptInterface
        public void retry() {
            String server = prefs.getString("server", "");
            if (!server.isEmpty()) ui.post(() -> openServer(server));
        }

        @JavascriptInterface
        public String notifyPermission() {
            return notifPermission();
        }

        @JavascriptInterface
        public void requestNotifyPermission() {
            if (Build.VERSION.SDK_INT >= 33 && !"granted".equals(notifPermission())) {
                prefs.edit().putBoolean("notifAsked", true).apply();
                ui.post(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF));
            } else {
                js("window.__mpPermCb&&window.__mpPermCb(" + q(notifPermission()) + ")");
            }
        }

        @JavascriptInterface
        public void notify(String title, String body, String tag) {
            if (!"granted".equals(notifPermission())) return;
            Intent open = new Intent(MainActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(MainActivity.this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(MainActivity.this, CHANNEL)
                : new Notification.Builder(MainActivity.this).setPriority(Notification.PRIORITY_HIGH).setDefaults(Notification.DEFAULT_ALL);
            b.setSmallIcon(R.drawable.ic_stat).setColor(Color.parseColor("#670626"))
                .setContentTitle(title).setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setAutoCancel(true).setContentIntent(pi);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            int id = tag != null && !tag.isEmpty() ? tag.hashCode() : notifId++;
            nm.notify(id, b.build());
        }
    }
}
