package ar.com.delben.domotica;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Entiende frases como «Delben, encendé el pasillo», «apagá la cocina», «apagá todas las luces»,
 * «¿está prendido el termo?» y las ejecuta en Tuya. Devuelve la respuesta que se dice en voz alta.
 */
public class Comandos {

    public static class Resultado {
        public final String texto;
        public final boolean entendido;
        Resultado(String t, boolean e) { texto = t; entendido = e; }
    }

    private static final Set<String> PRENDER = new HashSet<>(Arrays.asList(
            "encende", "encender", "enciende", "encendeme", "encendelo", "encendela", "encendes",
            "prende", "prender", "prendeme", "prendelo", "prendela", "prendes",
            "activa", "activar", "activame", "conecta", "conectar", "abri", "abrir", "pone", "poner"));
    private static final Set<String> APAGAR = new HashSet<>(Arrays.asList(
            "apaga", "apagar", "apagame", "apagalo", "apagala", "apagas",
            "desactiva", "desactivar", "desconecta", "desconectar", "corta", "cortar", "cerra", "cerrar"));
    private static final Set<String> ALIAS_DELBEN = new HashSet<>(Arrays.asList(
            "delben", "delbem", "delven", "delvent", "delbien", "delpen", "delbene", "delvena",
            "delbent", "delvin", "delbin", "telben", "telven", "elben", "delveme", "dellben"));

    // ------------------------------------------------------------------ texto

    public static String normalizar(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = n.replaceAll("[^a-z0-9 ]", " ");
        n = " " + n.replaceAll("\\s+", " ") + " ";
        n = n.replaceAll(" a pag", " apag").replaceAll(" en cend", " encend");
        n = n.replace(" uno ", " 1 ").replace(" dos ", " 2 ").replace(" tres ", " 3 ").replace(" cuatro ", " 4 ")
                .replace(" cinco ", " 5 ").replace(" seis ", " 6 ");
        n = n.replace(" television ", " tv ").replace(" televisor ", " tv ").replace(" tele ", " tv ")
                .replace(" teve ", " tv ").replace(" lamparita ", " lampara ").replace(" velador ", " lampara ");
        return n.replaceAll("\\s+", " ").trim();
    }

    /** Si el texto (ya normalizado) trae «Delben», devuelve lo que viene después (puede ser ""). Si no, null. */
    public static String despuesDeDelben(String n) {
        String[] t = n.split(" ");
        for (int i = 0; i < t.length; i++) {
            if (pareceDelben(t[i])) return unir(t, i + 1);
            if (i + 1 < t.length && pareceDelben(t[i] + t[i + 1])) return unir(t, i + 2);
            if (i + 2 < t.length && pareceDelben(t[i] + t[i + 1] + t[i + 2])) return unir(t, i + 3);
        }
        return null;
    }

    static boolean pareceDelben(String w) {
        if (w.length() < 5 || w.length() > 9) return false;
        return ALIAS_DELBEN.contains(w) || distancia(w, "delben") <= 1;
    }

    /**
     * true = encender, false = apagar, null = no dijo.
     * Reconoce cualquier forma del verbo (apagá, apague, apagalo, apaguen, «a pagar»…),
     * pero no los estados («prendido», «apagada»), que son preguntas.
     */
    public static Boolean accion(String n) {
        for (String w : n.split(" ")) {
            if (APAGAR.contains(w)) return Boolean.FALSE;
            if (PRENDER.contains(w)) return Boolean.TRUE;
            if (esEstado(w)) continue;
            if (w.startsWith("apag") || w.startsWith("desactiv") || w.startsWith("descon")
                    || w.startsWith("desenchuf")) return Boolean.FALSE;
            if (w.startsWith("encend") || w.startsWith("encien") || w.startsWith("prend")
                    || w.startsWith("activ") || w.startsWith("conect") || w.startsWith("enchuf")) return Boolean.TRUE;
        }
        return null;
    }

    private static boolean esEstado(String w) {
        return w.matches(".*(ido|ida|idos|idas|ado|ada|ados|adas)$");
    }

    public static boolean tieneAccion(String n) {
        return accion(normalizar(n)) != null;
    }

    private static boolean palabra(String n, String w) {
        return (" " + n + " ").contains(" " + w + " ");
    }

    // ------------------------------------------------------------------ ejecutar

    public static Resultado ejecutar(Context ctx, String dicho) {
        Tuya tuya = new Tuya(ctx);
        String n = normalizar(dicho);
        String resto = despuesDeDelben(n);
        if (resto != null) n = resto;
        if (n.isEmpty()) return new Resultado("Te escucho. Decime qué querés encender o apagar.", false);
        if (!tuya.configurado()) return new Resultado("Primero cargá las claves de Tuya en Ajustes.", true);

        Boolean accion = accion(n);
        boolean todo = palabra(n, "todo") || palabra(n, "toda") || palabra(n, "todos");
        boolean luces = palabra(n, "luces") || (palabra(n, "todas") && palabra(n, "luz"));
        boolean consulta = accion == null && (palabra(n, "esta") || palabra(n, "estado") || palabra(n, "como"));

        JSONArray equipos;
        try {
            equipos = (todo || luces || consulta || tuya.edadCache() > 5 * 60 * 1000 || tuya.cache().length() == 0)
                    ? tuya.equipos() : tuya.cache();
        } catch (Exception e) {
            equipos = tuya.cache();
            if (equipos.length() == 0) return new Resultado("No me pude conectar con Tuya. " + e.getMessage(), true);
        }

        Busqueda b = buscar(equipos, n);
        JSONObject eq = b.equipo;

        // Grupos: «apagá todo», «encendé todas las luces»
        if (eq == null && (todo || luces) && accion != null) {
            int hechos = 0, fallas = 0;
            for (int i = 0; i < equipos.length(); i++) {
                JSONObject e = equipos.optJSONObject(i);
                if (e == null || !e.optBoolean("control") || !e.optBoolean("online")) continue;
                if (luces && !"luces".equals(e.optString("grupo"))) continue;
                if (e.optBoolean("prendido") == accion) continue;
                try { tuya.cambiar(e.optString("id"), e.optString("codigo"), accion); hechos++; }
                catch (Exception ex) { fallas++; }
            }
            if (hechos == 0 && fallas == 0) {
                String ya = luces ? "Ya estaban todas las luces " + (accion ? "encendidas." : "apagadas.")
                        : "Ya estaba todo " + (accion ? "encendido." : "apagado.");
                return new Resultado(ya, true);
            }
            String r = "Listo, " + (accion ? "encendí " : "apagué ") + (luces ? "todas las luces" : "todo") + ".";
            if (fallas > 0) r += " " + fallas + (fallas == 1 ? " equipo no respondió." : " equipos no respondieron.");
            return new Resultado(r, true);
        }

        if (eq == null) {
            if (b.ambiguo) return new Resultado("Hay varios equipos con ese nombre. Decime cuál.", accion != null);
            return new Resultado(accion == null ? "No entendí. Probá con «Delben, encender pasillo»."
                    : "No encontré ese equipo. Decime el nombre como está en Smart Life.", accion != null);
        }

        String nombre = conArticulo(eq.optString("nombre"));
        boolean fem = nombre.startsWith("la ") || nombre.startsWith("las ");
        String encendido = fem ? "encendida" : "encendido";
        String apagado = fem ? "apagada" : "apagado";

        if (accion == null && !consulta) {
            return new Resultado("¿Querés que encienda o que apague " + nombre + "?", true);
        }
        if (accion == null) {
            if (!eq.optBoolean("online")) return new Resultado(mayuscula(nombre) + " está sin conexión.", true);
            if (!eq.optBoolean("control")) return new Resultado("Todavía no puedo ver el estado de " + nombre + ".", true);
            return new Resultado(mayuscula(nombre) + " está " + (eq.optBoolean("prendido") ? encendido : apagado) + ".", true);
        }
        if (!eq.optBoolean("control"))
            return new Resultado("Todavía no puedo manejar " + nombre + " desde DelBen.", true);
        if (!eq.optBoolean("online"))
            return new Resultado(mayuscula(nombre) + " está sin conexión. No lo puedo " + (accion ? "encender." : "apagar."), true);
        try {
            tuya.cambiar(eq.optString("id"), eq.optString("codigo"), accion);
            return new Resultado("Listo, " + nombre + " ya está " + (accion ? encendido : apagado) + ".", true);
        } catch (Exception e) {
            return new Resultado("No pude " + (accion ? "encender " : "apagar ") + nombre + ". " + e.getMessage(), true);
        }
    }

    /** Escenas de los botones de arriba: "apagar" (apaga todo) y "noche" (luces apagadas menos el pasillo). */
    public static String escena(Context ctx, String cual) {
        Tuya tuya = new Tuya(ctx);
        if (!tuya.configurado()) return "Primero cargá las claves de Tuya en Ajustes.";
        JSONArray equipos;
        try { equipos = tuya.equipos(); } catch (Exception e) { return "No me pude conectar con Tuya. " + e.getMessage(); }
        int hechos = 0, fallas = 0;
        for (int i = 0; i < equipos.length(); i++) {
            JSONObject e = equipos.optJSONObject(i);
            if (e == null || !e.optBoolean("control") || !e.optBoolean("online")) continue;
            boolean quiero;
            if ("noche".equals(cual)) {
                if (!"luces".equals(e.optString("grupo"))) continue;
                quiero = normalizar(e.optString("nombre")).contains("pasillo");
            } else {
                quiero = false;
            }
            if (e.optBoolean("prendido") == quiero) continue;
            try { tuya.cambiar(e.optString("id"), e.optString("codigo"), quiero); hechos++; }
            catch (Exception ex) { fallas++; }
        }
        String r = "noche".equals(cual) ? "Modo noche listo: queda encendido solo el pasillo." : "Listo, apagué todo.";
        if (hechos == 0 && fallas == 0) r = "noche".equals(cual) ? "Ya estaba en modo noche." : "Ya estaba todo apagado.";
        if (fallas > 0) r += " " + fallas + (fallas == 1 ? " equipo no respondió." : " equipos no respondieron.");
        return r;
    }

    // ------------------------------------------------------------------ buscar equipo

    static class Busqueda {
        JSONObject equipo;
        boolean ambiguo;
    }

    /**
     * Nombre completo dentro de la frase (gana el más largo: «tele chicos» antes que «chicos»);
     * si no, todas sus palabras importantes parecidas; si no, la mitad o más (solo si no hay empate).
     */
    static Busqueda buscar(JSONArray equipos, String n) {
        Busqueda r = new Busqueda();
        String conEsp = " " + n + " ";
        String[] tk = n.split(" ");
        List<JSONObject> mejores = new ArrayList<>();
        int mejor = 0;
        for (int i = 0; i < equipos.length(); i++) {
            JSONObject e = equipos.optJSONObject(i);
            if (e == null) continue;
            String nom = normalizar(e.optString("nombre"));
            if (nom.isEmpty()) continue;
            int puntos;
            if (conEsp.contains(" " + nom + " ")) {
                puntos = 1000 + nom.length();
            } else {
                int total = 0, ok = 0;
                for (String w : nom.split(" ")) {
                    if (RELLENO.contains(w)) continue;
                    total++;
                    if (tokenEn(w, tk)) ok++;
                }
                if (total == 0) continue;
                if (ok == total) puntos = 500 + nom.length();
                else puntos = (100 * ok) / total;
            }
            if (puntos < 50) continue;
            if (puntos > mejor) { mejor = puntos; mejores.clear(); mejores.add(e); }
            else if (puntos == mejor) mejores.add(e);
        }
        if (mejores.size() == 1) r.equipo = mejores.get(0);
        else if (mejores.size() > 1) r.ambiguo = true; // p. ej. «la tele» con varias teles
        return r;
    }

    private static final Set<String> RELLENO = new HashSet<>(Arrays.asList(
            "el", "la", "los", "las", "de", "del", "luz", "al", "en", "por", "favor", "y", "a"));

    private static boolean tokenEn(String w, String[] tk) {
        if (RELLENO.contains(w)) return false;
        for (String t : tk) {
            if (t.equals(w)) return true;
            if (w.length() >= 5 && t.length() >= 4 && distancia(w, t) <= 1) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------ frases

    private static final Set<String> FEMENINOS = new HashSet<>(Arrays.asList(
            "tv", "luz", "lampara", "bomba", "pileta", "cocina", "estufa", "heladera", "puerta", "galeria",
            "entrada", "cochera", "pieza", "habitacion", "tira", "guirnalda", "calefaccion", "persiana"));
    private static final Set<String> MASCULINOS_A = new HashSet<>(Arrays.asList("dia", "sofa", "mapa", "clima"));

    /** «Pasillo» → «el pasillo», «Cocina» → «la cocina», «TV Comedor» → «la TV comedor». */
    static String conArticulo(String nombre) {
        String[] palabras = nombre.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < palabras.length; i++) {
            String w = palabras[i];
            boolean sigla = w.length() <= 4 && w.equals(w.toUpperCase(Locale.ROOT)) && w.matches(".*[A-Z].*");
            if (i > 0) sb.append(' ');
            sb.append(sigla ? w : w.toLowerCase(Locale.ROOT));
        }
        String n = normalizar(nombre);
        String primera = n.isEmpty() ? "" : n.split(" ")[0];
        boolean fem = FEMENINOS.contains(primera) || (primera.endsWith("a") && !MASCULINOS_A.contains(primera));
        boolean plural = primera.endsWith("s") && primera.length() > 3 && !primera.endsWith("is");
        String art = plural ? (fem ? "las" : "los") : (fem ? "la" : "el");
        return art + " " + sb;
    }

    private static String mayuscula(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String unir(String[] t, int desde) {
        StringBuilder sb = new StringBuilder();
        for (int i = desde; i < t.length; i++) {
            if (t[i].isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(t[i]);
        }
        return sb.toString();
    }

    static int distancia(String a, String b) {
        int[] prev = new int[b.length() + 1], cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int c = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + c);
            }
            int[] x = prev; prev = cur; cur = x;
        }
        return prev[b.length()];
    }
}
