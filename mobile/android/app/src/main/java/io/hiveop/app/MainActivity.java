package io.hiveop.app;

import android.content.pm.ActivityInfo;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.security.SecureRandom;
import java.util.Collections;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private HiveOpAuth auth;
    private boolean authSheetOpen;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // ph-04: the secure sheet's return. Only a valid hiveop://auth link for a pending bounce delivers.
        Uri data = intent == null ? null : intent.getData();
        if (auth != null && data != null && auth.onReturn(data.toString())) authSheetOpen = false;
        openPushPath(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Back in front with the sheet gone and no auth return seen: the user closed it (cancel).
        if (auth != null && authSheetOpen) {
            authSheetOpen = false;
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (auth != null) auth.onResumedWithoutReturn();
            }, 400);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HiveOpShellPlugin.class);
        super.onCreate(savedInstanceState);
        // Mic/camera for the site origin only (after the OS grant).
        Bridge b = getBridge();
        if (b != null && b.getServerUrl() != null) {
            String site = MediaPolicy.originOf(b.getServerUrl());
            if (site != null) b.getWebView().setWebChromeClient(new SiteWebChromeClient(b, site));
        }
        // Phones stay portrait; tablets (smallest width >= 600dp) rotate freely.
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
        // Phone shell: outside pages open in a sheet, never in the main WebView; bridge on the site only.
        HiveOpShell shell = HiveOpShell.load(this);
        if (shell != null && getBridge() != null) {
            shell.installBridge(getBridge().getWebView());
            shell.installChannel(getBridge().getWebView(), this);
            getBridge().setWebViewClient(new HiveOpShell.Client(getBridge(), shell));
            installAuthBounce(shell);
        }

        // Launched by tapping a notification: open its path.
        if (savedInstanceState == null) openPushPath(getIntent());
    }

    /**
     * A tapped FCM notification relaunches or resumes the app with its data as intent extras
     * (the system tray shows it; the app need not be running). Opens the sanitised `path` in the
     * web view. Only intents FCM delivered are considered.
     */
    private void openPushPath(Intent intent) {
        if (intent == null || !intent.hasExtra("google.message_id")) return;
        Bridge b = getBridge();
        if (b == null || b.getServerUrl() == null) return;
        String site = MediaPolicy.originOf(b.getServerUrl());
        if (site == null) return;
        String target = PushPath.targetUrl(intent.getStringExtra("path"), site);
        intent.removeExtra("google.message_id");
        b.getWebView().loadUrl(target);
    }

    /** ph-04: page -> native bridge for the secure sign-in sheet, reachable from the site origin only. */
    private void installAuthBounce(HiveOpShell shell) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        auth = new HiveOpAuth(shell.oauthApi, shell.siteOrigin, url -> {
            CustomTabsIntent tab = new CustomTabsIntent.Builder().setShowTitle(true).build();
            authSheetOpen = true;
            tab.launchUrl(this, Uri.parse(url));
        }, new SecureRandom());
        WebViewCompat.addWebMessageListener(
            getBridge().getWebView(),
            "hiveopAuthNative",
            Collections.singleton(shell.siteOrigin),
            (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                String data = message.getData();
                if (!isMainFrame || data == null) return;
                auth.start(data, replyProxy::postMessage);
            });
    }
}
