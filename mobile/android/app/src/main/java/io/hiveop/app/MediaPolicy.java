package io.hiveop.app;

import java.net.URI;
import java.util.Locale;

/**
 * Who may use the mic and camera through the WebView. Pure (no Android types) so a JVM test
 * can run it. Reference: mobile/src/mediaPolicy.ts, same fixture.
 */
final class MediaPolicy {
    static final String AUDIO_CAPTURE = "android.webkit.resource.AUDIO_CAPTURE";
    static final String VIDEO_CAPTURE = "android.webkit.resource.VIDEO_CAPTURE";

    private MediaPolicy() {}

    /** scheme://host[:port] with default ports dropped, or null when not a plain http(s) origin. */
    static String originOf(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        try {
            URI u = new URI(raw);
            String scheme = u.getScheme() == null ? null : u.getScheme().toLowerCase(Locale.ROOT);
            if (!"http".equals(scheme) && !"https".equals(scheme)) return null;
            if (u.getUserInfo() != null || u.getHost() == null) return null;
            int port = u.getPort();
            boolean dflt = port == -1 || (port == 80 && "http".equals(scheme)) || (port == 443 && "https".equals(scheme));
            return scheme + "://" + u.getHost().toLowerCase(Locale.ROOT) + (dflt ? "" : ":" + port);
        } catch (Exception e) {
            return null;
        }
    }

    static boolean isSiteOrigin(String requestOrigin, String siteOrigin) {
        String a = originOf(requestOrigin);
        String b = originOf(siteOrigin);
        return a != null && a.equals(b);
    }

    /** Only mic/camera capture, and only for the site. The OS grant is asked after this passes. */
    static boolean allowed(String requestOrigin, String siteOrigin, String[] resources) {
        if (resources == null || resources.length == 0) return false;
        for (String r : resources) {
            if (!AUDIO_CAPTURE.equals(r) && !VIDEO_CAPTURE.equals(r)) return false;
        }
        return isSiteOrigin(requestOrigin, siteOrigin);
    }
}
