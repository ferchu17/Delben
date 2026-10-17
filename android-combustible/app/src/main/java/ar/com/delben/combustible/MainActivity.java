package ar.com.delben.combustible;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
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

import androidx.core.content.FileProvider;

import java.io.File;

/**
 * Control de Combustible: abre https://ferchu17.github.io/Delben/combustible/ a pantalla completa,
 * sin la barra de dirección de Chrome arriba.
 *
 * - La página de DELBEN y la app de Apps Script (script.google.com / googleusercontent.com) se abren dentro.
 * - "Sacar foto" abre la cámara del celular; "Elegir de la galería" abre las fotos.
 * - WhatsApp, Drive y cualquier otra dirección se abren afuera (en la app que corresponda).
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://ferchu17.github.io/Delben/combustible/";
    private static final int PEDIDO_ARCHIVO = 10;
    private static final int PEDIDO_FOTO = 11;
    private static final int PERMISO_CAMARA = 12;

    private WebView web;
    private ValueCallback<Uri[]> callbackArchivo;
    private Uri fotoUri;
    private PermissionRequest pedidoWeb;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 21) {
            w.setStatusBarColor(Color.parseColor("#0C2F7A"));
            w.setNavigationBarColor(Color.WHITE);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#EEF2F7"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
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
                if (Build.VERSION.SDK_INT >= 21 && !request.isForMainFrame()) return false; // la app dentro del recuadro
                return decidir(request.getUrl());
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return decidir(Uri.parse(url));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // Links que se abren en ventana nueva (Drive, WhatsApp, sacar clave, etc.): afuera.
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

            // "Sacar foto" (cámara) y "Elegir de la galería".
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (callbackArchivo != null) callbackArchivo.onReceiveValue(null);
                callbackArchivo = callback;
                if (params.isCaptureEnabled()) {
                    pedirCamara();
                } else {
                    try {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("image/*");
                        startActivityForResult(Intent.createChooser(i, "Elegir foto del ticket"), PEDIDO_ARCHIVO);
                    } catch (ActivityNotFoundException e) {
                        devolver(null);
                        return false;
                    }
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    pedidoWeb = request;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISO_CAMARA);
                } else {
                    request.grant(request.getResources());
                }
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(INICIO);
        }
    }

    private void pedirCamara() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PERMISO_CAMARA);
        } else {
            abrirCamara();
        }
    }

    private void abrirCamara() {
        try {
            File dir = new File(getCacheDir(), "fotos");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "ticket_" + System.currentTimeMillis() + ".jpg");
            fotoUri = FileProvider.getUriForFile(this, getPackageName() + ".fotos", f);
            Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            i.putExtra(MediaStore.EXTRA_OUTPUT, fotoUri);
            i.setClipData(ClipData.newRawUri("", fotoUri));
            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(i, PEDIDO_FOTO);
        } catch (Exception e) {
            Toast.makeText(this, "No se pudo abrir la cámara", Toast.LENGTH_SHORT).show();
            devolver(null);
        }
    }

    private void devolver(Uri[] r) {
        if (callbackArchivo != null) {
            callbackArchivo.onReceiveValue(r);
            callbackArchivo = null;
        }
    }

    /** true = la dirección se abre afuera; false = se abre dentro de la app. */
    private boolean decidir(Uri uri) {
        String esquema = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        boolean esWeb = esquema.equals("https") || esquema.equals("http");
        boolean adentro = esWeb && (host.equals("ferchu17.github.io") || host.equals("script.google.com")
                || host.endsWith(".googleusercontent.com") || host.equals("accounts.google.com"));
        if (adentro) return false;
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
            devolver(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            return;
        }
        if (requestCode == PEDIDO_FOTO) {
            devolver(resultCode == RESULT_OK && fotoUri != null ? new Uri[]{fotoUri} : null);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == PERMISO_CAMARA) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pedidoWeb != null) {
                if (ok) pedidoWeb.grant(pedidoWeb.getResources()); else pedidoWeb.deny();
                pedidoWeb = null;
            }
            if (callbackArchivo != null) {
                if (ok) abrirCamara();
                else {
                    Toast.makeText(this, "Sin permiso de cámara. Elegí la foto de la galería.", Toast.LENGTH_LONG).show();
                    devolver(null);
                }
            }
        }
    }

    // Botón "Atrás" del celular: vuelve a la página anterior; si no hay, sale de la app.
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
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
