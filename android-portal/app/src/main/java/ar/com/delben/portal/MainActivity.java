package ar.com.delben.portal;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * Portal DELBEN: abre https://ferchu17.github.io/Delben/portal/ a pantalla completa,
 * sin la barra de dirección de Chrome arriba.
 *
 * - Las páginas de DELBEN (ferchu17.github.io) se abren dentro de la app.
 * - Informe de Novedades se abre en Chrome, porque el dictado por voz solo anda ahí.
 * - WhatsApp, Drive, descargas de APK y cualquier otra dirección se abren afuera
 *   (en WhatsApp, en el navegador o en la app que corresponda).
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://ferchu17.github.io/Delben/portal/";
    private static final String HOST_DELBEN = "ferchu17.github.io";
    private static final int PEDIDO_ARCHIVO = 10;
    private static final int PEDIDO_PERMISOS = 11;

    private WebView web;
    private ValueCallback<Uri[]> callbackArchivo;
    private PermissionRequest pedidoPendiente;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 21) {
            w.setStatusBarColor(Color.parseColor("#1040A0"));
            w.setNavigationBarColor(Color.WHITE);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#BCD9F7"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        if (Build.VERSION.SDK_INT >= 21) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        }
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

        web.setWebChromeClient(new WebChromeClient() {
            // window.open(...) (por ejemplo el botón de WhatsApp): se abre afuera.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                WebView temporal = new WebView(MainActivity.this);
                temporal.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                        abrirAfuera(r.getUrl());
                        v.destroy();
                        return true;
                    }

                    @SuppressWarnings("deprecation")
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        abrirAfuera(Uri.parse(url));
                        v.destroy();
                        return true;
                    }
                });
                WebView.WebViewTransport t = (WebView.WebViewTransport) resultMsg.obj;
                t.setWebView(temporal);
                resultMsg.sendToTarget();
                return true;
            }

            // Botones para elegir archivos o fotos dentro de las páginas.
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (callbackArchivo != null) callbackArchivo.onReceiveValue(null);
                callbackArchivo = callback;
                try {
                    startActivityForResult(params.createIntent(), PEDIDO_ARCHIVO);
                } catch (ActivityNotFoundException e) {
                    callbackArchivo = null;
                    return false;
                }
                return true;
            }

            // Cámara y micrófono para las páginas de DELBEN.
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (!HOST_DELBEN.equals(request.getOrigin().getHost())) {
                    request.deny();
                    return;
                }
                if (Build.VERSION.SDK_INT >= 23 &&
                        (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ||
                         checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)) {
                    pedidoPendiente = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO}, PEDIDO_PERMISOS);
                } else {
                    request.grant(request.getResources());
                }
            }
        });

        // Descargas (APK u otros archivos): las hace el navegador del celular.
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            abrirAfuera(Uri.parse(url));
            Toast.makeText(this, "Descargando… cuando termine, tocá el archivo para instalarlo", Toast.LENGTH_LONG).show();
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(INICIO);
        }
    }

    /** true = la dirección se abre afuera; false = se abre dentro de la app. */
    private boolean decidir(Uri uri) {
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String ruta = uri.getPath() == null ? "" : uri.getPath().toLowerCase();

        boolean esWeb = esquema.equals("https") || esquema.equals("http");
        boolean esDelben = esWeb && host.equals(HOST_DELBEN);
        boolean esApk = ruta.endsWith(".apk");
        boolean esInforme = ruta.contains("/informe-de-novedades");

        if (esDelben && !esApk && !esInforme) return false;
        abrirAfuera(uri);
        return true;
    }

    private void abrirAfuera(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No hay una app para abrir este link", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == PEDIDO_ARCHIVO) {
            if (callbackArchivo != null) {
                callbackArchivo.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                callbackArchivo = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == PEDIDO_PERMISOS && pedidoPendiente != null) {
            boolean ok = true;
            for (int r : grantResults) ok &= (r == PackageManager.PERMISSION_GRANTED);
            if (ok) pedidoPendiente.grant(pedidoPendiente.getResources());
            else pedidoPendiente.deny();
            pedidoPendiente = null;
        }
    }

    // Botón "Atrás" del celular: vuelve a la página anterior; en el portal, sale de la app.
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
