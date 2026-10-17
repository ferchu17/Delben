package ar.com.delben.domotica;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Conexión con la nube de Tuya (la misma que usa Smart Life).
 * Las claves (Access ID, Access Secret) y el UID de la cuenta se cargan en Ajustes
 * y quedan guardadas solo en este teléfono; no están en el código.
 *
 * Cada equipo se convierte en una o más "entradas" (una por tecla, en las llaves de varias teclas):
 * {id, codigo, nombre, grupo: luces|energia|ir, online, prendido, control}
 */
public class Tuya {

    public static final String PREFS = "delben";

    private static String token = null;
    private static long vence = 0;

    private final SharedPreferences p;

    public Tuya(Context c) {
        p = c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public SharedPreferences prefs() { return p; }

    public boolean configurado() {
        return !p.getString("accessId", "").trim().isEmpty()
                && !p.getString("secret", "").trim().isEmpty()
                && !p.getString("uid", "").trim().isEmpty();
    }

    private String servidor() {
        return p.getString("servidor", "https://openapi.tuyaus.com");
    }

    public static void olvidarToken() {
        synchronized (Tuya.class) { token = null; vence = 0; }
    }

    // ------------------------------------------------------------------ firma y pedidos

    private JSONObject http(String metodo, String ruta, String cuerpo, String tok) throws Exception {
        String id = p.getString("accessId", "").trim();
        String sec = p.getString("secret", "").trim();
        String t = String.valueOf(System.currentTimeMillis());
        String nonce = UUID.randomUUID().toString();
        String body = cuerpo == null ? "" : cuerpo;
        String aFirmar = metodo + "\n" + sha256(body) + "\n" + "\n" + ruta;
        String firma = hmac(id + (tok == null ? "" : tok) + t + nonce + aFirmar, sec);

        HttpURLConnection c = (HttpURLConnection) new URL(servidor() + ruta).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(15000);
        c.setRequestMethod(metodo);
        c.setRequestProperty("client_id", id);
        c.setRequestProperty("sign", firma);
        c.setRequestProperty("t", t);
        c.setRequestProperty("sign_method", "HMAC-SHA256");
        c.setRequestProperty("nonce", nonce);
        c.setRequestProperty("Content-Type", "application/json");
        if (tok != null) c.setRequestProperty("access_token", tok);
        if (cuerpo != null) {
            c.setDoOutput(true);
            OutputStream os = c.getOutputStream();
            os.write(body.getBytes(StandardCharsets.UTF_8));
            os.close();
        }
        int codigo = c.getResponseCode();
        InputStream in = codigo >= 400 ? c.getErrorStream() : c.getInputStream();
        String txt = leer(in);
        c.disconnect();
        if (txt.isEmpty()) throw new IOException("Tuya no respondió (" + codigo + ")");
        return new JSONObject(txt);
    }

    private String token() throws Exception {
        synchronized (Tuya.class) {
            if (token != null && System.currentTimeMillis() < vence) return token;
            JSONObject r = http("GET", "/v1.0/token?grant_type=1", null, null);
            if (!r.optBoolean("success")) throw new Exception(mensaje(r));
            JSONObject res = r.getJSONObject("result");
            token = res.getString("access_token");
            vence = System.currentTimeMillis() + Math.max(60, res.optLong("expire_time", 7200) - 120) * 1000L;
            return token;
        }
    }

    private JSONObject api(String metodo, String ruta, String cuerpo) throws Exception {
        JSONObject r = http(metodo, ruta, cuerpo, token());
        if (!r.optBoolean("success")) {
            int cod = r.optInt("code");
            if (cod == 1010 || cod == 1011 || cod == 1012) { // token vencido: se pide otro y se reintenta
                olvidarToken();
                r = http(metodo, ruta, cuerpo, token());
            }
        }
        if (!r.optBoolean("success")) throw new Exception(mensaje(r));
        return r;
    }

    private static String mensaje(JSONObject r) {
        int cod = r.optInt("code");
        String msg = r.optString("msg", "");
        switch (cod) {
            case 1004: return "Las claves de Tuya no son correctas (Access ID o Access Secret).";
            case 1106: return "Tuya no da permiso: revisá el UID y que la cuenta de Smart Life esté vinculada al proyecto.";
            case 1100: case 1101: return "Tuya rechazó los datos: revisá el UID.";
            case 2009: case 28841002: return "El servicio de Tuya está vencido: renová el período de prueba (IoT Core) en la plataforma.";
            case 2017: return "Ese equipo no está vinculado al proyecto de Tuya.";
            default: return "Tuya: " + (msg.isEmpty() ? "error" : msg) + " (" + cod + ")";
        }
    }

    // ------------------------------------------------------------------ equipos

    /** Pide la lista actualizada a Tuya, la guarda en el teléfono y la devuelve. */
    public JSONArray equipos() throws Exception {
        String uid = p.getString("uid", "").trim();
        JSONObject r = api("GET", "/v1.0/users/" + uid + "/devices", null);
        JSONArray lista = r.optJSONArray("result");
        if (lista == null) {
            JSONObject o = r.optJSONObject("result");
            lista = o == null ? null : o.optJSONArray("devices");
        }
        JSONArray salida = armar(lista == null ? new JSONArray() : lista);
        p.edit().putString("cache", salida.toString()).putLong("cacheHora", System.currentTimeMillis()).apply();
        return salida;
    }

    /** Última lista guardada (sirve para mostrar algo enseguida y para la voz). */
    public JSONArray cache() {
        try { return new JSONArray(p.getString("cache", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    public long edadCache() {
        return System.currentTimeMillis() - p.getLong("cacheHora", 0);
    }

    public void cambiar(String id, String codigo, boolean valor) throws Exception {
        JSONObject cmd = new JSONObject().put("code", codigo).put("value", valor);
        JSONObject cuerpo = new JSONObject().put("commands", new JSONArray().put(cmd));
        api("POST", "/v1.0/devices/" + id + "/commands", cuerpo.toString());
        // Se actualiza la lista guardada para que la pantalla y la voz queden al día
        try {
            JSONArray c = cache();
            for (int i = 0; i < c.length(); i++) {
                JSONObject e = c.getJSONObject(i);
                if (id.equals(e.optString("id")) && codigo.equals(e.optString("codigo"))) e.put("prendido", valor);
            }
            p.edit().putString("cache", c.toString()).apply();
        } catch (Exception ignored) { }
    }

    private static final Pattern TECLA = Pattern.compile("^switch_(\\d+)$");

    static JSONArray armar(JSONArray lista) throws Exception {
        List<JSONObject> salida = new ArrayList<>();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject d = lista.optJSONObject(i);
            if (d == null) continue;
            String cat = d.optString("category", "");
            if (cat.equals("wnykq")) continue; // el control infrarrojo en sí (no se prende ni se apaga)
            String id = d.optString("id");
            String nombre = d.optString("name", "Equipo").trim();
            boolean online = d.optBoolean("online", false);

            // Teclas: switch_led, switch, switch_1, switch_2...
            List<String> codigos = new ArrayList<>();
            List<Boolean> valores = new ArrayList<>();
            JSONArray st = d.optJSONArray("status");
            if (st != null) {
                for (int j = 0; j < st.length(); j++) {
                    JSONObject s = st.optJSONObject(j);
                    if (s == null) continue;
                    String code = s.optString("code");
                    Object v = s.opt("value");
                    if (!(v instanceof Boolean)) continue;
                    if (code.equals("switch_led") || code.equals("switch") || TECLA.matcher(code).matches()) {
                        codigos.add(code);
                        valores.add((Boolean) v);
                    }
                }
            }

            if (codigos.isEmpty()) {
                // Equipos por infrarrojo (teles, aire, decodificador) u otros sin tecla: pestaña "Tele y aire"
                salida.add(entrada(id, "", nombre, "ir", online, false, false));
                continue;
            }

            int teclasNumeradas = 0;
            for (String c : codigos) if (TECLA.matcher(c).matches()) teclasNumeradas++;
            String grupo = grupoPorNombre(nombre);

            if (teclasNumeradas > 1) {
                for (int k = 0; k < codigos.size(); k++) {
                    Matcher m = TECLA.matcher(codigos.get(k));
                    if (!m.matches()) continue;
                    salida.add(entrada(id, codigos.get(k), nombre + " " + m.group(1), grupo, online, valores.get(k), true));
                }
            } else {
                int idx = codigos.indexOf("switch_led");
                if (idx < 0) idx = codigos.indexOf("switch_1");
                if (idx < 0) idx = codigos.indexOf("switch");
                if (idx < 0) idx = 0;
                salida.add(entrada(id, codigos.get(idx), nombre, grupo, online, valores.get(idx), true));
            }
        }
        Collections.sort(salida, (a, b) -> a.optString("nombre").compareToIgnoreCase(b.optString("nombre")));
        JSONArray r = new JSONArray();
        for (JSONObject o : salida) r.put(o);
        return r;
    }

    private static JSONObject entrada(String id, String codigo, String nombre, String grupo,
                                      boolean online, boolean prendido, boolean control) throws Exception {
        return new JSONObject()
                .put("id", id).put("codigo", codigo).put("nombre", nombre).put("grupo", grupo)
                .put("online", online).put("prendido", prendido).put("control", control);
    }

    /** Con tecla: termo, bomba, pileta, teles, enchufes, etc. van a "Energía"; el resto a "Luces". */
    static String grupoPorNombre(String nombre) {
        String n = Comandos.normalizar(nombre);
        String[] energia = {"termo", "bomba", "pileta", "tv", "enchufe", "heladera", "calef", "lavarropas",
                "router", "modem", "ventilador", "estufa", "riego", "porton", "motor", "aire"};
        for (String e : energia) if (n.contains(e)) return "energia";
        return "luces";
    }

    // ------------------------------------------------------------------ utilidades

    private static String leer(InputStream in) throws IOException {
        if (in == null) return "";
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        in.close();
        return b.toString("UTF-8");
    }

    private static String sha256(String s) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        return hex(md.digest(s.getBytes(StandardCharsets.UTF_8))).toLowerCase(Locale.ROOT);
    }

    private static String hmac(String datos, String clave) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(clave.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return hex(mac.doFinal(datos.getBytes(StandardCharsets.UTF_8))).toUpperCase(Locale.ROOT);
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
}
