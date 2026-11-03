package io.hiveop.app;

/**
 * Where tapping a notification goes. Pure (no Android types) so a JVM test can run it.
 * Reference: mobile/src/pushPath.ts, same fixture (src/fixtures/pushPath.cases.json).
 * Only a plain site path opens; anything else opens the site root.
 */
final class PushPath {
    static final int MAX_LENGTH = 2048;

    private PushPath() {}

    static String sanitize(Object raw) {
        if (!(raw instanceof String)) return "/";
        String s = (String) raw;
        if (s.isEmpty() || s.length() > MAX_LENGTH) return "/";
        if (!s.startsWith("/") || s.startsWith("//")) return "/";
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' || c < 0x20 || c == 0x7f) return "/";
        }
        return s;
    }

    /** Plain concatenation: the path starts with one '/', so it cannot change the origin. */
    static String targetUrl(Object raw, String siteOrigin) {
        String origin = siteOrigin;
        while (origin.endsWith("/")) origin = origin.substring(0, origin.length() - 1);
        return origin + sanitize(raw);
    }
}
