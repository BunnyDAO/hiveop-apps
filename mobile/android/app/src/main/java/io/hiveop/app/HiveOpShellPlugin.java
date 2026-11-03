package io.hiveop.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The shell's own native calls for the site (window.hiveopApp.openSettings). */
@CapacitorPlugin(name = "HiveOpShell")
public class HiveOpShellPlugin extends Plugin {
    /** This app's page in the phone's Settings (where a blocked notification switch is turned back on). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("could not open settings");
        }
    }
}
