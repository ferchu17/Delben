package ar.com.delben.domotica;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** La voz que contesta («Listo, el pasillo ya está encendido»). Una sola para toda la app. */
public class Voz {

    private static TextToSpeech tts;
    private static boolean lista = false;
    private static String pendiente = null;
    private static Runnable pendienteFin = null;
    private static final Map<String, Runnable> alTerminar = new HashMap<>();
    private static final Handler h = new Handler(Looper.getMainLooper());

    public static void preparar(Context c) {
        if (tts != null) return;
        tts = new TextToSpeech(c.getApplicationContext(), estado -> {
            if (estado != TextToSpeech.SUCCESS) return;
            int r = tts.setLanguage(new Locale("es", "AR"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                r = tts.setLanguage(new Locale("es", "US"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED)
                    tts.setLanguage(new Locale("es", "ES"));
            }
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { terminar(id); }
                @Override @SuppressWarnings("deprecation") public void onError(String id) { terminar(id); }
                @Override public void onError(String id, int codigo) { terminar(id); }
                @Override public void onStop(String id, boolean interrumpido) { terminar(id); }
            });
            lista = true;
            if (pendiente != null) {
                String t = pendiente; Runnable f = pendienteFin;
                pendiente = null; pendienteFin = null;
                hablar(t, f);
            }
        });
    }

    /** Dice el texto; cuando termina (o si falla) corre alTerminar en el hilo principal. */
    public static void decir(Context c, String texto, Runnable fin) {
        preparar(c);
        if (!lista) {
            if (pendienteFin != null) h.post(pendienteFin);
            pendiente = texto;
            pendienteFin = fin;
            // Si el teléfono no tiene voz instalada, no se queda trabado esperando
            h.postDelayed(() -> {
                if (!lista && pendiente != null && pendiente.equals(texto)) {
                    Runnable f = pendienteFin;
                    pendiente = null; pendienteFin = null;
                    if (f != null) f.run();
                }
            }, 5000);
            return;
        }
        hablar(texto, fin);
    }

    private static void hablar(String texto, Runnable fin) {
        String id = UUID.randomUUID().toString();
        synchronized (alTerminar) { if (fin != null) alTerminar.put(id, fin); }
        int r = tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, id);
        if (r != TextToSpeech.SUCCESS) terminar(id);
    }

    private static void terminar(String id) {
        Runnable f;
        synchronized (alTerminar) { f = alTerminar.remove(id); }
        if (f != null) h.post(f);
    }
}
