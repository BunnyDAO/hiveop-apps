package io.hiveop.app;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * Google/GitHub sign-in through a Custom Tab (ph-04). Mirrors src/authBounce.ts: the PKCE
 * verifier is made and kept here, in memory, one at a time; the site only ever receives
 * {handoff, verifier} after a valid hiveop://auth return. Rules are shared with the desktop app
 * (see src/fixtures/authReturn.cases.json).
 */
final class HiveOpAuth {
    interface Opener { void open(String url) throws Exception; }
    interface Reply { void send(String json); }

    static final long TTL_MS = 10 * 60_000L;
    private static final Pattern HANDOFF = Pattern.compile("^[A-Za-z0-9._~-]{16,512}$");

    private final String oauthApi;
    private final String siteOrigin;
    private final Opener opener;
    private final SecureRandom random;

    private String verifier;
    private long expires;
    private Reply reply;
    private String id;
    private long nowOverride = -1;

    HiveOpAuth(String oauthApi, String siteOrigin, Opener opener, SecureRandom random) {
        this.oauthApi = oauthApi;
        this.siteOrigin = siteOrigin;
        this.opener = opener;
        this.random = random;
    }

    void setNowForTest(long now) { nowOverride = now; }
    private long now() { return nowOverride >= 0 ? nowOverride : System.currentTimeMillis(); }

    static String b64url(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    static String challengeFor(String verifier) throws Exception {
        return b64url(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes("UTF-8")));
    }

    private static String enc(String v) {
        try { return java.net.URLEncoder.encode(v, "UTF-8"); } catch (Exception e) { throw new RuntimeException(e); }
    }

    static String startUrl(String oauthApi, String siteOrigin, String provider, String challenge) {
        String base = oauthApi.replaceAll("/+$", "");
        return base + "/auth/oauth/" + provider
            + "?returnTo=" + enc(siteOrigin + "/desktop-return")
            + "&code_challenge=" + enc(challenge)
            + "&code_challenge_method=S256";
    }

    /** The handoff in a hiveop://auth?handoff=… link, or null (strict: one param, charset, length). */
    static String parseHandoff(String raw) {
        if (raw == null) return null;
        java.net.URI u;
        try { u = new java.net.URI(raw); } catch (Exception e) { return null; }
        if (u.getScheme() == null || !u.getScheme().equalsIgnoreCase("hiveop")) return null;
        if (u.getHost() == null || !u.getHost().equalsIgnoreCase("auth")) return null;
        String q = u.getRawQuery();
        if (q == null) return null;
        String found = null;
        for (String pair : q.split("&")) {
            int eq = pair.indexOf('=');
            String k = eq < 0 ? pair : pair.substring(0, eq);
            if (!k.equals("handoff")) continue;
            if (found != null) return null; // two handoff params
            try { found = java.net.URLDecoder.decode(eq < 0 ? "" : pair.substring(eq + 1), "UTF-8"); } catch (Exception e) { return null; }
        }
        return found != null && HANDOFF.matcher(found).matches() ? found : null;
    }

    /** Begin a bounce from a page message {"id":…,"provider":"google|github|apple"}; replaces any pending one. */
    synchronized void start(String message, Reply reply) {
        String provider;
        String msgId;
        try {
            JSONObject m = new JSONObject(message);
            provider = m.getString("provider");
            msgId = String.valueOf(m.get("id"));
        } catch (Exception e) {
            return;
        }
        if (!provider.equals("google") && !provider.equals("github") && !provider.equals("apple")) return;
        if (this.reply != null) finish("cancelled", null); // a newer start replaces the old one
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        verifier = b64url(raw);
        expires = now() + TTL_MS;
        this.reply = reply;
        this.id = msgId;
        try {
            opener.open(startUrl(oauthApi, siteOrigin, provider, challengeFor(verifier)));
        } catch (Exception e) {
            finish("cancelled", null);
        }
    }

    /** A hiveop:// link reached the app. Only a valid auth return for a pending bounce delivers. */
    synchronized boolean onReturn(String uri) {
        if (reply == null) return false;
        String handoff = parseHandoff(uri);
        if (handoff == null) return false; // not ours (e.g. hiveop://open): the resume check decides
        finish("handoff", handoff);
        return true;
    }

    /** The app is foreground again with the sheet gone and no return seen: the user closed it. */
    synchronized void onResumedWithoutReturn() {
        if (reply != null) finish("cancelled", null);
    }

    synchronized boolean isPending() { return reply != null; }

    private void finish(String result, String handoff) {
        Reply r = reply;
        String v = verifier;
        boolean live = now() <= expires;
        reply = null;
        verifier = null;
        if (r == null) return;
        try {
            JSONObject o = new JSONObject().put("id", Long.parseLong(id)).put("result", "cancelled");
            if (handoff != null && live) o.put("result", "handoff").put("handoff", handoff).put("verifier", v);
            r.send(o.toString());
        } catch (Exception ignored) {
            // nothing to tell the page
        }
    }
}
