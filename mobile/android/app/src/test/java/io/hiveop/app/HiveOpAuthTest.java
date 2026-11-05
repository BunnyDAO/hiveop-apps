package io.hiveop.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class HiveOpAuthTest {
    private static final String API = "https://api.wenrwa.com/api/v1";
    private static final String SITE = "https://app.hiveop.io";
    private static final String HO = "abcdefghijklmnop1234";

    @Test
    public void returnCasesMatchTheSharedFixture() throws Exception {
        JSONObject f = new JSONObject(new String(Files.readAllBytes(Paths.get("../../src/fixtures/authReturn.cases.json"))));
        JSONArray rows = f.getJSONArray("return");
        assertTrue(rows.length() > 5);
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            assertEquals(r.getString(0), r.isNull(2) ? null : r.getString(2), HiveOpAuth.parseHandoff(r.getString(1)));
        }
    }

    private static final class Rig {
        final List<String> opened = new ArrayList<>();
        final List<JSONObject> replies = new ArrayList<>();
        final HiveOpAuth auth = new HiveOpAuth(API, SITE, opened::add, new SecureRandom());
        void start(int id, String provider) {
            auth.start("{\"id\":" + id + ",\"provider\":\"" + provider + "\"}", s -> {
                try { replies.add(new JSONObject(s)); } catch (Exception e) { throw new RuntimeException(e); }
            });
        }
    }

    @Test
    public void appleRunsTheWebFlowInTheSheetAndUnknownProvidersAreIgnored() throws Exception {
        Rig r = new Rig();
        r.start(1, "apple");
        assertEquals(1, r.opened.size());
        assertTrue(r.opened.get(0), r.opened.get(0).startsWith(API + "/auth/oauth/apple?"));
        assertTrue(r.opened.get(0), r.opened.get(0).contains("code_challenge_method=S256"));
        Rig other = new Rig();
        other.start(1, "twitter");
        assertEquals(0, other.opened.size());
    }

    @Test
    public void startOpensBackendWithChallengeThenReturnDeliversVerifier() throws Exception {
        Rig r = new Rig();
        r.start(1, "github");
        assertEquals(1, r.opened.size());
        String url = r.opened.get(0);
        assertTrue(url, url.startsWith(API + "/auth/oauth/github?"));
        assertTrue(url, url.contains("returnTo=" + java.net.URLEncoder.encode(SITE + "/desktop-return", "UTF-8")));
        assertTrue(url, url.contains("code_challenge_method=S256"));
        assertTrue(r.auth.onReturn("hiveop://auth?handoff=" + HO));
        JSONObject out = r.replies.get(0);
        assertEquals("handoff", out.getString("result"));
        assertEquals(HO, out.getString("handoff"));
        assertEquals(1, out.getInt("id"));
        assertTrue(url.contains("code_challenge=" + HiveOpAuth.challengeFor(out.getString("verifier"))));
        assertFalse(r.auth.isPending());
        assertFalse(r.auth.onReturn("hiveop://auth?handoff=" + HO)); // single use
    }

    @Test
    public void closingTheSheetIsACancel() {
        Rig r = new Rig();
        r.start(2, "google");
        r.auth.onResumedWithoutReturn();
        assertEquals("cancelled", r.replies.get(0).optString("result"));
        r.auth.onResumedWithoutReturn(); // no second reply
        assertEquals(1, r.replies.size());
    }

    @Test
    public void nonAuthReturnDoesNotDeliver() {
        Rig r = new Rig();
        r.start(3, "google");
        assertFalse(r.auth.onReturn("hiveop://open"));
        assertTrue(r.replies.isEmpty());
        r.auth.onResumedWithoutReturn();
        assertEquals("cancelled", r.replies.get(0).optString("result"));
    }

    @Test
    public void expiredBounceCancels() {
        Rig r = new Rig();
        r.auth.setNowForTest(1000);
        r.start(4, "google");
        r.auth.setNowForTest(1000 + HiveOpAuth.TTL_MS + 1);
        r.auth.onReturn("hiveop://auth?handoff=" + HO);
        assertEquals("cancelled", r.replies.get(0).optString("result"));
    }

    @Test
    public void unknownProviderAndStrayReturnAreIgnored() {
        Rig r = new Rig();
        r.start(5, "twitter");
        assertTrue(r.opened.isEmpty());
        assertFalse(r.auth.onReturn("hiveop://auth?handoff=" + HO));
        assertNull(HiveOpAuth.parseHandoff(null));
    }

    @Test
    public void aNewStartCancelsTheOld() {
        Rig r = new Rig();
        r.start(6, "google");
        r.start(7, "github");
        assertEquals("cancelled", r.replies.get(0).optString("result"));
        assertEquals(6, r.replies.get(0).optInt("id"));
        assertTrue(r.auth.isPending());
    }
}
