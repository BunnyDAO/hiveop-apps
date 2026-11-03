package io.hiveop.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Phone-shell navigation policy and bridge injection. The policy mirrors src/navPolicy.ts
 * (in-app / sheet / deny) and is fed by assets/public/hiveop-shell.json, written by `npm run prepare`.
 */
final class HiveOpShell {
    enum Decision { IN_APP, SHEET, SYSTEM_BROWSER, DENY }

    final String siteOrigin;
    final String oauthApi;
    final List<String> authHosts = new ArrayList<>();
    final String bridgeScript;

    private HiveOpShell(JSONObject json, boolean pushAvailable) throws Exception {
        siteOrigin = json.getString("siteOrigin");
        oauthApi = json.optString("oauthApi", "https://api.wenrwa.com/api/v1");
        JSONArray hosts = json.getJSONArray("authHosts");
        for (int i = 0; i < hosts.length(); i++) authHosts.add(hosts.getString(i));
        String script = json.getJSONObject("bridgeScripts").getString("android");
        // No Firebase config in this build (google-services.json absent): push is simply unavailable.
        bridgeScript = pushAvailable ? script : "window.__hiveopNoPush=true;" + script;
    }

    static HiveOpShell load(Context context) {
        try (InputStream in = context.getAssets().open("public/hiveop-shell.json")) {
            byte[] bytes = in.readAllBytes();
            return new HiveOpShell(new JSONObject(new String(bytes, "UTF-8")), pushConfigured(context));
        } catch (Exception e) {
            return null;
        }
    }

    /** The google-services plugin writes google_app_id into the build only when google-services.json is present. */
    static boolean pushConfigured(Context context) {
        return context.getResources().getIdentifier("google_app_id", "string", context.getPackageName()) != 0;
    }

    static String originOf(Uri u) {
        String scheme = u.getScheme();
        String host = u.getHost();
        if (scheme == null || host == null) return "";
        int port = u.getPort();
        int def = "https".equals(scheme) ? 443 : 80;
        return scheme + "://" + host + (port == -1 || port == def ? "" : ":" + port);
    }

    Decision decide(Uri u) {
        return decide(u, false);
    }

    /** `linkOut`: the caller deliberately leaves the app (openExternal): outside pages go to the system browser. */
    Decision decide(Uri u, boolean linkOut) {
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
        if (scheme.equals("hiveop")) return Decision.IN_APP;
        if (!(scheme.equals("http") || scheme.equals("https")) || u.getHost() == null) return Decision.DENY;
        if (originOf(u).equals(siteOrigin)) return Decision.IN_APP;
        if (scheme.equals("https") && u.getPort() == -1 && authHosts.contains(u.getHost().toLowerCase())) {
            return Decision.IN_APP;
        }
        return linkOut ? Decision.SYSTEM_BROWSER : Decision.SHEET;
    }

    /** Custom Tab over the app. The main WebView is not touched; closing returns to it. */
    static void openSheet(Context context, Uri url) {
        String scheme = url.getScheme();
        if (!("http".equals(scheme) || "https".equals(scheme))) return;
        CustomTabsIntent tab = new CustomTabsIntent.Builder()
            .setShowTitle(true)
            .setDefaultColorSchemeParams(new CustomTabColorSchemeParams.Builder().setToolbarColor(Color.parseColor("#0b0d12")).build())
            .build();
        tab.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            tab.launchUrl(context, url);
        } catch (Exception e) {
            // No Custom Tabs provider and no browser: nothing to show; the app stays put.
        }
    }

    /** The system browser (not a sheet), https only: the US "buy on hiveop.io" link-out. */
    static boolean openSystemBrowser(Context context, Uri url) {
        if (!"https".equals(url.getScheme())) return false;
        Intent intent = new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * The native side of window.hiveopApp's storefront()/openExternal(): a web message listener
     * the WebView exposes as `hiveopNative` to the site origin ONLY (and re-checked per message).
     * Requests are JSON {id, m, a}; replies JSON {id, ok, value|error}.
     */
    void installChannel(WebView webView, Context context) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(webView, "hiveopNative", Collections.singleton(siteOrigin),
            (view, message, sourceOrigin, isMainFrame, reply) -> {
                String data = message.getData();
                if (!isMainFrame || data == null || !siteOrigin.equals(originOf(sourceOrigin))) return;
                handleMessage(context, data, json -> new Handler(Looper.getMainLooper()).post(() -> reply.postMessage(json)));
            });
    }

    interface Reply {
        void send(String json);
    }

    void handleMessage(Context context, String raw, Reply reply) {
        int id = -1;
        try {
            JSONObject req = new JSONObject(raw);
            id = req.getInt("id");
            final int rid = id;
            String method = req.optString("m");
            if ("storefront".equals(method)) {
                Storefront.lookup(context, country -> {
                    try {
                        JSONObject value = new JSONObject().put("country", country == null ? JSONObject.NULL : country);
                        reply.send(new JSONObject().put("id", rid).put("ok", true).put("value", value).toString());
                    } catch (Exception e) {
                        reply.send(error(rid, "storefront failed"));
                    }
                });
            } else if ("openExternal".equals(method)) {
                String url = req.optJSONObject("a") == null ? "" : req.getJSONObject("a").optString("url");
                if (!ExternalLink.canLinkOut(url, siteOrigin, authHosts)) {
                    reply.send(error(rid, "not an external https URL"));
                } else if (decide(Uri.parse(url), true) != Decision.SYSTEM_BROWSER || !openSystemBrowser(context, Uri.parse(url))) {
                    reply.send(error(rid, "could not open"));
                } else {
                    reply.send(new JSONObject().put("id", rid).put("ok", true).put("value", JSONObject.NULL).toString());
                }
            } else {
                reply.send(error(rid, "unknown method"));
            }
        } catch (Exception e) {
            if (id >= 0) reply.send(error(id, "bad request"));
        }
    }

    private static String error(int id, String message) {
        try {
            return new JSONObject().put("id", id).put("ok", false).put("error", message).toString();
        } catch (Exception e) {
            return "{\"id\":" + id + ",\"ok\":false}";
        }
    }

    /**
     * Document-start injection scoped to the site origin natively; the script also guards itself,
     * so the onPageStarted fallback (older WebViews) still never exposes it elsewhere.
     */
    void installBridge(WebView webView) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, bridgeScript, Collections.singleton(siteOrigin));
        }
    }

    boolean hasNativeDocumentStart() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
    }

    /**
     * Main-frame navigations are decided here; everything else keeps Capacitor's behaviour. A
     * window.open / target=_blank load lands in this same WebView (multiple windows are off), so it
     * is caught here too and never replaces the page.
     */
    static final class Client extends BridgeWebViewClient {
        private final HiveOpShell shell;
        private final Bridge bridge;

        Client(Bridge bridge, HiveOpShell shell) {
            super(bridge);
            this.bridge = bridge;
            this.shell = shell;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return super.shouldOverrideUrlLoading(view, request);
            Uri url = request.getUrl();
            switch (shell.decide(url)) {
                case IN_APP:
                    return super.shouldOverrideUrlLoading(view, request);
                case SHEET:
                    openSheet(bridge.getContext(), url);
                    return true;
                default:
                    return true;
            }
        }

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            if (!shell.hasNativeDocumentStart() && url != null && originOf(Uri.parse(url)).equals(shell.siteOrigin)) {
                view.evaluateJavascript(shell.bridgeScript, null);
            }
        }
    }
}
