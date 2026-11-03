package io.hiveop.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Runs the shared fixture (mobile/src/fixtures/mediaOrigin.cases.json) through MediaPolicy. */
public class MediaPolicyTest {
    private static JSONObject load() throws Exception {
        return new JSONObject(new String(Files.readAllBytes(Paths.get("../../src/fixtures/mediaOrigin.cases.json"))));
    }

    @Test
    public void originCases() throws Exception {
        JSONObject f = load();
        String site = f.getString("siteOrigin");
        JSONArray rows = f.getJSONArray("origin");
        assertTrue(rows.length() > 5);
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            assertEquals(r.getString(0), r.getBoolean(2), MediaPolicy.isSiteOrigin(r.getString(1), site));
        }
    }

    @Test
    public void resourceCases() throws Exception {
        JSONObject f = load();
        String site = f.getString("siteOrigin");
        JSONArray rows = f.getJSONArray("resources");
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            JSONArray res = r.getJSONArray(1);
            String[] mapped = new String[res.length()];
            for (int j = 0; j < mapped.length; j++) {
                String s = res.getString(j);
                mapped[j] = s.equals("audio") ? MediaPolicy.AUDIO_CAPTURE : s.equals("video") ? MediaPolicy.VIDEO_CAPTURE : s;
            }
            assertEquals(r.getString(0), r.getBoolean(2), MediaPolicy.allowed(site, site, mapped));
        }
    }

    @Test
    public void foreignOriginDeniedEvenForAudio() {
        assertEquals(false, MediaPolicy.allowed("https://example.com", "https://app.hiveop.io", new String[] {MediaPolicy.AUDIO_CAPTURE}));
    }
}
