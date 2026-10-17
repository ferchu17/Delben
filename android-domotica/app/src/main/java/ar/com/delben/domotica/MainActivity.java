package ar.com.delben.domotica;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Pantalla de DelBen Domótica. El diseño está en assets/web/index.html;
 * la página habla con esta clase a través del objeto «Delben» (ver Puente).
 */
public class MainActivity extends Activity {

    private static final int PERMISOS = 5;

    private WebView web;
    private Tuya tuya;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final ExecutorService ex = Executors.newSingleThreadExecutor();
    private SpeechRecognizer sr;
    private Runnable despuesDePermiso;
    private BroadcastReceiver rx;
    private boolean paginaLista = false;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.parseColor("#070B18"));
        getWindow().setNavigationBarColor(Color.parseColor("#070B18"));

        tuya = new Tuya(this);
        Voz.preparar(this);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#070B18"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Puente(), "Delben");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
                catch (ActivityNotFoundException e) { aviso("No hay una app para abrir este link"); }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) { paginaLista = true; }
        });
        web.loadUrl("file:///android_asset/web/index.html");

        rx = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) { refrescar(); enviarConfig(); }
        };
        IntentFilter f = new IntentFilter(VozService.CAMBIO);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(rx, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(rx, f);

        // Si la escucha permanente estaba activada, se vuelve a encender al abrir la app
        if (tuya.prefs().getBoolean("escucha", false) && !VozService.activo && tienePermiso(Manifest.permission.RECORD_AUDIO)) {
            arrancarEscucha();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (paginaLista) js("delbenVolvio", new JSONObject());
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.delbenAtras ? window.delbenAtras() : false", v -> {
            if (!"true".equals(v)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(rx); } catch (Exception ignored) { }
        if (sr != null) sr.destroy();
        ex.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    // ------------------------------------------------------------------ hacia la página

    private void js(String funcion, JSONObject datos) {
        String code = "window." + funcion + " && window." + funcion + "(" + datos.toString() + ")";
        h.post(() -> web.evaluateJavascript(code, null));
    }

    private void voz(String estado, String texto, String respuesta) {
        try {
            JSONObject o = new JSONObject().put("estado", estado);
            if (texto != null) o.put("texto", texto);
            if (respuesta != null) o.put("respuesta", respuesta);
            js("delbenVoz", o);
        } catch (Exception ignored) { }
    }

    private void aviso(String t) {
        h.post(() -> Toast.makeText(this, t, Toast.LENGTH_SHORT).show());
    }

    private JSONObject config() {
        SharedPreferences p = tuya.prefs();
        JSONObject o = new JSONObject();
        try {
            o.put("accessId", p.getString("accessId", ""));
            o.put("tieneSecret", !p.getString("secret", "").isEmpty());
            o.put("uid", p.getString("uid", ""));
            o.put("servidor", p.getString("servidor", "https://openapi.tuyaus.com"));
            o.put("configurado", tuya.configurado());
            o.put("escucha", p.getBoolean("escucha", false));
            o.put("escuchaActiva", VozService.activo);
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            o.put("bateriaOk", pm.isIgnoringBatteryOptimizations(getPackageName()));
            o.put("version", getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
        } catch (Exception ignored) { }
        return o;
    }

    private void enviarConfig() { js("delbenConfig", config()); }

    private void refrescar() {
        ex.execute(() -> {
            JSONObject o = new JSONObject();
            try {
                if (!tuya.configurado()) {
                    o.put("ok", false).put("falta", true).put("equipos", new JSONArray());
                } else {
                    try {
                        o.put("ok", true).put("equipos", tuya.equipos());
                    } catch (Exception e) {
                        o.put("ok", false).put("error", e.getMessage()).put("equipos", tuya.cache());
                    }
                }
            } catch (Exception ignored) { }
            js("delbenDatos", o);
        });
    }

    // ------------------------------------------------------------------ permisos

    private boolean tienePermiso(String p) {
        return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED;
    }

    private void conPermisos(String[] permisos, Runnable siHay) {
        List<String> faltan = new ArrayList<>();
        for (String p : permisos) if (!tienePermiso(p)) faltan.add(p);
        if (faltan.isEmpty()) { siHay.run(); return; }
        despuesDePermiso = siHay;
        requestPermissions(faltan.toArray(new String[0]), PERMISOS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != PERMISOS) return;
        Runnable r = despuesDePermiso;
        despuesDePermiso = null;
        if (tienePermiso(Manifest.permission.RECORD_AUDIO)) {
            if (r != null) r.run();
        } else {
            aviso("Sin permiso de micrófono no puedo escucharte");
            tuya.prefs().edit().putBoolean("escucha", false).apply();
            enviarConfig();
            voz("error", null, "Necesito permiso para usar el micrófono.");
        }
    }

    private String[] permisosEscucha() {
        if (Build.VERSION.SDK_INT >= 33)
            return new String[]{Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS};
        return new String[]{Manifest.permission.RECORD_AUDIO};
    }

    // ------------------------------------------------------------------ escucha permanente

    private void arrancarEscucha() {
        Intent i = new Intent(this, VozService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
            else startService(i);
        } catch (Exception e) {
            aviso("No se pudo activar la escucha: " + e.getMessage());
        }
        h.postDelayed(this::enviarConfig, 800);
    }

    private void servicio(String accion) {
        if (!VozService.activo) return;
        try { startService(new Intent(this, VozService.class).setAction(accion)); }
        catch (Exception ignored) { }
    }

    // ------------------------------------------------------------------ micrófono dentro de la app

    private void escucharAhora() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            voz("error", null, "Este teléfono no tiene el reconocimiento de voz de Google.");
            return;
        }
        servicio(VozService.PAUSA); // libera el micrófono mientras se usa el botón
        if (sr != null) sr.destroy();
        sr = SpeechRecognizer.createSpeechRecognizer(this);
        sr.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { voz("escuchando", null, null); }
            @Override public void onBeginningOfSpeech() { }
            @Override public void onRmsChanged(float v) { }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { }
            @Override public void onEvent(int t, Bundle b) { }

            @Override
            public void onPartialResults(Bundle b) {
                ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (l != null && !l.isEmpty() && !l.get(0).isEmpty()) voz("oyendo", l.get(0), null);
            }

            @Override
            public void onResults(Bundle b) {
                ArrayList<String> l = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String dicho = l == null || l.isEmpty() ? "" : l.get(0);
                if (dicho.trim().isEmpty()) { onError(SpeechRecognizer.ERROR_NO_MATCH); return; }
                ejecutarDicho(dicho);
            }

            @Override
            public void onError(int error) {
                String r = error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT
                        ? "No hay internet para entender la voz."
                        : error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS
                        ? "Necesito permiso para usar el micrófono."
                        : "No te escuché bien. Probá de nuevo.";
                voz("error", null, r);
                servicio(VozService.SEGUIR);
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-AR");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        sr.startListening(i);
    }

    private void ejecutarDicho(String dicho) {
        voz("pensando", "«" + dicho + "»", null);
        ex.execute(() -> {
            Comandos.Resultado r = Comandos.ejecutar(this, dicho);
            voz("resultado", "«" + dicho + "»", r.texto);
            h.post(() -> Voz.decir(this, r.texto, () -> servicio(VozService.SEGUIR)));
            JSONObject o = new JSONObject();
            try { o.put("ok", true).put("equipos", tuya.cache()); } catch (Exception ignored) { }
            js("delbenDatos", o);
        });
    }

    // ------------------------------------------------------------------ lo que la página puede pedir

    public class Puente {

        @JavascriptInterface
        public String config() { return MainActivity.this.config().toString(); }

        @JavascriptInterface
        public String cache() { return tuya.cache().toString(); }

        @JavascriptInterface
        public void refrescar() { MainActivity.this.refrescar(); }

        @JavascriptInterface
        public void guardar(String json) {
            try {
                JSONObject o = new JSONObject(json);
                SharedPreferences.Editor e = tuya.prefs().edit();
                e.putString("accessId", o.optString("accessId", "").trim());
                String sec = o.optString("secret", "").trim();
                if (!sec.isEmpty()) e.putString("secret", sec);
                e.putString("uid", o.optString("uid", "").trim());
                String srv = o.optString("servidor", "").trim();
                if (srv.startsWith("https://")) e.putString("servidor", srv);
                e.putLong("cacheHora", 0);
                e.apply();
                Tuya.olvidarToken();
                enviarConfig();
                MainActivity.this.refrescar();
            } catch (Exception ex) {
                aviso("No se pudieron guardar los datos");
            }
        }

        @JavascriptInterface
        public void cambiar(String id, String codigo, boolean valor) {
            ex.execute(() -> {
                JSONObject o = new JSONObject();
                try {
                    o.put("id", id).put("codigo", codigo).put("valor", valor);
                    try {
                        tuya.cambiar(id, codigo, valor);
                        o.put("ok", true);
                    } catch (Exception e) {
                        o.put("ok", false).put("error", e.getMessage());
                    }
                } catch (Exception ignored) { }
                js("delbenResultado", o);
            });
        }

        @JavascriptInterface
        public void escena(String cual) {
            ex.execute(() -> {
                String t = Comandos.escena(MainActivity.this, cual);
                try { js("delbenEscena", new JSONObject().put("texto", t)); } catch (Exception ignored) { }
                h.post(() -> Voz.decir(MainActivity.this, t, null));
                JSONObject o = new JSONObject();
                try { o.put("ok", true).put("equipos", tuya.cache()); } catch (Exception ignored) { }
                js("delbenDatos", o);
            });
        }

        @JavascriptInterface
        public void hablar() {
            h.post(() -> conPermisos(new String[]{Manifest.permission.RECORD_AUDIO}, MainActivity.this::escucharAhora));
        }

        @JavascriptInterface
        public void escuchaPermanente(boolean activar) {
            h.post(() -> {
                if (activar) {
                    conPermisos(permisosEscucha(), () -> {
                        tuya.prefs().edit().putBoolean("escucha", true).apply();
                        arrancarEscucha();
                    });
                } else {
                    tuya.prefs().edit().putBoolean("escucha", false).apply();
                    if (VozService.activo) {
                        try { startService(new Intent(MainActivity.this, VozService.class).setAction(VozService.DETENER)); }
                        catch (Exception ignored) { }
                    }
                    h.postDelayed(MainActivity.this::enviarConfig, 500);
                }
            });
        }

        @JavascriptInterface
        @SuppressLint("BatteryLife")
        public void bateria() {
            h.post(() -> {
                try {
                    Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    i.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(i);
                } catch (Exception e) {
                    try {
                        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        i.setData(Uri.parse("package:" + getPackageName()));
                        startActivity(i);
                    } catch (Exception ignored) { aviso("Abrí Ajustes → Batería y dejá DelBen sin restricciones"); }
                }
            });
        }

        @JavascriptInterface
        public void decir(String texto) {
            h.post(() -> Voz.decir(MainActivity.this, texto, null));
        }
    }
}
