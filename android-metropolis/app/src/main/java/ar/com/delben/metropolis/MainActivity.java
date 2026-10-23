package ar.com.delben.metropolis;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Metrópolis Infinita: abre el juego a pantalla completa (sin barras del sistema),
 * con la pantalla siempre encendida. La partida se guarda en el almacenamiento de la vista web.
 * El botón Atrás abre el menú del juego; dos veces seguidas, sale.
 * Realizado por Fernando Jacyno · 10/2026
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://ferchu17.github.io/Delben/metropolis/";
    private static final String HOST = "ferchu17.github.io";

    private WebView web;
    private long ultimoAtras = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.BLACK);
            getWindow().setNavigationBarColor(Color.BLACK);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0b111a"));
        setContentView(web);
        pantallaCompleta();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        CookieManager.getInstance().setAcceptCookie(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return decidir(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return decidir(Uri.parse(url));
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(INICIO);
    }

    /** true = se abre afuera (WhatsApp, otras páginas); false = dentro del juego. */
    private boolean decidir(Uri uri) {
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ((esquema.equals("https") || esquema.equals("http")) && host.equals(HOST)) return false;
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir este link", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    private void pantallaCompleta() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) pantallaCompleta();
    }

    // Atrás: abre el menú del juego (que guarda la partida). Dos veces seguidas: sale.
    @Override
    public void onBackPressed() {
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoAtras < 1800) {
            super.onBackPressed();
            return;
        }
        ultimoAtras = ahora;
        if (web != null) {
            web.evaluateJavascript("window.dispatchEvent(new Event('metropolis-atras'));", null);
        }
        Toast.makeText(this, "Tocá Atrás otra vez para salir", Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('pagehide'));", null);
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }
}
