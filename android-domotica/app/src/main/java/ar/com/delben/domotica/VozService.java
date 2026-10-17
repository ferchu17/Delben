package ar.com.delben.domotica;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import org.json.JSONObject;
import org.vosk.LibVosk;
import org.vosk.LogLevel;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Escucha permanente: queda corriendo con un aviso fijo en la barra (Android lo exige)
 * y reconoce la voz en el propio teléfono, sin internet, con el modelo en español de Vosk.
 * Cuando oye «Delben …» ejecuta la orden en Tuya y contesta en voz alta,
 * aunque la app esté cerrada y la pantalla apagada.
 */
public class VozService extends Service implements RecognitionListener {

    public static final String DETENER = "ar.com.delben.domotica.DETENER";
    public static final String PAUSA = "ar.com.delben.domotica.PAUSA";
    public static final String SEGUIR = "ar.com.delben.domotica.SEGUIR";
    /** Aviso para que la pantalla se actualice cuando la voz cambió algo. */
    public static final String CAMBIO = "ar.com.delben.domotica.CAMBIO";

    private static final String CANAL = "escucha";
    private static final int NOTI = 7;

    public static volatile boolean activo = false;

    private Model modelo;
    private SpeechService escucha;
    private PowerManager.WakeLock wl;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final ExecutorService ex = Executors.newSingleThreadExecutor();
    private boolean pausado = false;
    private boolean hablando = false;
    private long esperandoHasta = 0;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Escucha «Delben»", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Aviso fijo mientras DelBen escucha tus órdenes");
            ch.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
        Voz.preparar(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent == null ? null : intent.getAction();

        if (DETENER.equals(a)) {
            new Tuya(this).prefs().edit().putBoolean("escucha", false).apply();
            detenerTodo();
            avisarApp();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!activo && (PAUSA.equals(a) || SEGUIR.equals(a))) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!activo) {
            try {
                Notification n = noti("Preparando la escucha…");
                if (Build.VERSION.SDK_INT >= 30) startForeground(NOTI, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
                else startForeground(NOTI, n);
            } catch (Exception e) {
                // Android no deja arrancar el micrófono desde atrás (por ejemplo después de reiniciar)
                stopSelf();
                return START_NOT_STICKY;
            }
            activo = true;
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "delben:escucha");
            wl.setReferenceCounted(false);
            wl.acquire();
            cargarModelo();
            avisarApp();
        }
        if (PAUSA.equals(a)) pausar(true);
        else if (SEGUIR.equals(a)) pausar(false);
        return START_STICKY;
    }

    private void cargarModelo() {
        LibVosk.setLogLevel(LogLevel.WARNINGS);
        StorageService.unpack(this, "model-es", "model",
                m -> {
                    if (!activo) { m.close(); return; }
                    modelo = m;
                    empezar();
                },
                e -> notificar("No se pudo preparar el reconocimiento de voz: " + e.getMessage()));
    }

    private void empezar() {
        try {
            Recognizer rec = new Recognizer(modelo, 16000.0f);
            escucha = new SpeechService(rec, 16000.0f);
            if (!pausado) escucha.startListening(this);
            notificar("Decí «Delben, encender pasillo»");
        } catch (IOException e) {
            notificar("No se pudo usar el micrófono");
        }
    }

    private void pausar(boolean p) {
        pausado = p;
        if (escucha == null) return;
        if (p) escucha.stop();
        else if (!hablando) escucha.startListening(this);
    }

    // ------------------------------------------------------------------ lo que se oye

    @Override public void onPartialResult(String hipotesis) { }

    @Override public void onResult(String hipotesis) { procesar(hipotesis); }

    @Override public void onFinalResult(String hipotesis) { procesar(hipotesis); }

    @Override
    public void onError(Exception e) {
        notificar("Error del micrófono, reintentando…");
        h.postDelayed(() -> { if (activo && escucha != null && !pausado && !hablando) escucha.startListening(this); }, 3000);
    }

    @Override public void onTimeout() { }

    private void procesar(String hipotesis) {
        String texto;
        try { texto = new JSONObject(hipotesis).optString("text", ""); }
        catch (Exception e) { return; }
        if (texto.trim().isEmpty() || hablando || pausado) return;

        String n = Comandos.normalizar(texto);
        String resto = Comandos.despuesDeDelben(n);
        long ahora = SystemClock.elapsedRealtime();

        if (resto == null) {
            // Dijo «Delben» solo y ahora la orden
            if (ahora < esperandoHasta) {
                esperandoHasta = 0;
                ejecutar(n, Comandos.tieneAccion(n));
            }
            return;
        }
        if (resto.isEmpty()) {
            esperandoHasta = ahora + 7000;
            pitido();
            notificar("Te escucho…");
            return;
        }
        ejecutar(resto, Comandos.tieneAccion(resto));
    }

    private void ejecutar(String orden, boolean responderSiNoEntiende) {
        notificar("«" + orden + "»");
        ex.execute(() -> {
            Comandos.Resultado r = Comandos.ejecutar(this, orden);
            h.post(() -> {
                if (!r.entendido && !responderSiNoEntiende) {
                    notificar("Decí «Delben, encender pasillo»");
                    return;
                }
                notificar(r.texto);
                decir(r.texto);
                avisarApp();
            });
        });
    }

    private void decir(String texto) {
        hablando = true;
        if (escucha != null) escucha.stop(); // para no escucharse a sí mismo
        Voz.decir(this, texto, () -> {
            hablando = false;
            if (activo && escucha != null && !pausado) escucha.startListening(this);
        });
    }

    private void pitido() {
        try {
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_MUSIC, 70);
            tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 180);
            h.postDelayed(tg::release, 400);
        } catch (Exception ignored) { }
    }

    private void avisarApp() {
        sendBroadcast(new Intent(CAMBIO).setPackage(getPackageName()));
    }

    // ------------------------------------------------------------------ aviso en la barra

    private Notification noti(String texto) {
        int fl = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent abrir = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), fl);
        PendingIntent parar = PendingIntent.getService(this, 1, new Intent(this, VozService.class).setAction(DETENER), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setSmallIcon(R.drawable.ic_noti)
                .setContentTitle("DelBen escuchando")
                .setContentText(texto)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setColor(0xFF2F8BFF)
                .setContentIntent(abrir)
                .addAction(new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_noti), "Detener", parar).build());
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        return b.build();
    }

    private void notificar(String texto) {
        if (!activo) return;
        try { getSystemService(NotificationManager.class).notify(NOTI, noti(texto)); }
        catch (Exception ignored) { }
    }

    // ------------------------------------------------------------------ cierre

    private void detenerTodo() {
        activo = false;
        try { if (escucha != null) { escucha.stop(); escucha.shutdown(); } } catch (Exception ignored) { }
        escucha = null;
        try { if (modelo != null) modelo.close(); } catch (Exception ignored) { }
        modelo = null;
        if (wl != null && wl.isHeld()) wl.release();
        stopForeground(Service.STOP_FOREGROUND_REMOVE);
    }

    @Override
    public void onDestroy() {
        detenerTodo();
        ex.shutdownNow();
        super.onDestroy();
    }
}
