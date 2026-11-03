package io.hiveop.app;

import android.webkit.PermissionRequest;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/**
 * Capacitor's client grants mic/camera to any page after the Android runtime prompt. This one
 * answers only the site origin (see MediaPolicy). For the site it defers to Capacitor, which
 * asks the OS and calls grant() only on yes, deny() on no; the page then sees the browser's
 * normal NotAllowedError. File inputs (incl. camera/photos) keep Capacitor's chooser.
 */
class SiteWebChromeClient extends BridgeWebChromeClient {
    private final String siteOrigin;

    SiteWebChromeClient(Bridge bridge, String siteOrigin) {
        super(bridge);
        this.siteOrigin = siteOrigin;
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        String origin = request.getOrigin() == null ? null : request.getOrigin().toString();
        if (!MediaPolicy.allowed(origin, siteOrigin, request.getResources())) {
            request.deny();
            return;
        }
        super.onPermissionRequest(request);
    }
}
