package io.hiveop.app;

import java.net.URI;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.List;

/**
 * Where a tapped HiveOp link (verified App Link) goes inside the app. Pure (no Android types) so a
 * JVM test can run it. Reference: mobile/src/universalLink.ts, same fixture
 * (src/fixtures/universalLink.cases.json). Returns the URL to load, or null to leave the app alone.
 */
final class UniversalLink {
    private UniversalLink() {}

    private static boolean excluded(String path) {
        String decoded;
        try {
            decoded = URLDecoder.decode(path.replace("+", "%2B"), "UTF-8").toLowerCase();
        } catch (Exception e) {
            return true;
        }
        for (String p : new String[] {"/api", "/desktop-return", "/.well-known"}) {
            if (decoded.equals(p) || decoded.startsWith(p + "/")) return true;
        }
        return false;
    }

    /** RFC 3986 dot-segment removal; %2e counts as a dot (as the URL parser does). */
    static String removeDots(String path) {
        List<String> out = new ArrayList<>();
        String[] parts = path.split("/", -1);
        for (int i = 1; i < parts.length; i++) {
            String s = parts[i].toLowerCase();
            boolean last = i == parts.length - 1;
            if (s.equals("..") || s.equals(".%2e") || s.equals("%2e.") || s.equals("%2e%2e")) {
                if (!out.isEmpty()) out.remove(out.size() - 1);
                if (last) out.add("");
            } else if (s.equals(".") || s.equals("%2e")) {
                if (last) out.add("");
            } else {
                out.add(parts[i]);
            }
        }
        return "/" + String.join("/", out);
    }

    static String target(Object raw, String siteOrigin) {
        if (!(raw instanceof String)) return null;
        String s = (String) raw;
        if (s.length() > PushPath.MAX_LENGTH) return null;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' || c < 0x20 || c == 0x7f) return null;
        }
        URI u;
        try {
            u = new URI(s);
        } catch (Exception e) {
            return null;
        }
        String site = siteOrigin;
        while (site.endsWith("/")) site = site.substring(0, site.length() - 1);
        String host = site.substring(site.indexOf("//") + 2);
        // The authority must be exactly the site host: no userinfo, no port, no lookalike.
        if (!"https".equalsIgnoreCase(u.getScheme()) || u.getRawAuthority() == null
            || !u.getRawAuthority().equalsIgnoreCase(host)) return null;
        String rawPath = u.getRawPath();
        String path = removeDots(rawPath == null || rawPath.isEmpty() ? "/" : rawPath);
        if (excluded(path)) return null;
        if (u.getRawQuery() != null) path += "?" + u.getRawQuery();
        if (u.getRawFragment() != null) path += "#" + u.getRawFragment();
        if (!PushPath.sanitize(path).equals(path)) return null;
        return PushPath.targetUrl(path, site);
    }
}
