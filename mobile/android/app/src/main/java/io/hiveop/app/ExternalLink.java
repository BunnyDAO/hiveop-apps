package io.hiveop.app;

import java.net.URI;
import java.util.List;
import java.util.Locale;

/**
 * Mirror of src/navPolicy.ts `canLinkOut`: may the site's openExternal(url) take this URL to the
 * system browser? https only, no credentials, and not something the shell keeps in the app (the
 * site itself, the backend auth chain). Plain Java so a unit test can run the shared fixture.
 */
final class ExternalLink {
    private ExternalLink() {}

    static boolean canLinkOut(String raw, String siteOrigin, List<String> authHosts) {
        if (raw == null) return false;
        URI u;
        try {
            u = new URI(raw);
        } catch (Exception e) {
            return false;
        }
        String scheme = u.getScheme();
        String host = u.getHost();
        if (scheme == null || !"https".equals(scheme.toLowerCase(Locale.ROOT)) || host == null) return false;
        if (u.getRawUserInfo() != null) return false;
        String origin = "https://" + host.toLowerCase(Locale.ROOT) + (u.getPort() == -1 || u.getPort() == 443 ? "" : ":" + u.getPort());
        if (origin.equals(siteOrigin)) return false;
        if (u.getPort() == -1 && authHosts.contains(host.toLowerCase(Locale.ROOT))) return false;
        return true;
    }
}
