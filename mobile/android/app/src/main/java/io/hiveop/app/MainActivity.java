package io.hiveop.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
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
            getBridge().setWebViewClient(new HiveOpShell.Client(getBridge(), shell));
        }
    }
}
