package io.hiveop.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Runs the shared fixture (mobile/src/fixtures/externalUrl.cases.json) through ExternalLink. */
public class ExternalLinkTest {
    @Test
    public void sharedCases() throws Exception {
        JSONObject f = new JSONObject(new String(Files.readAllBytes(Paths.get("../../src/fixtures/externalUrl.cases.json"))));
        String site = f.getString("siteOrigin");
        JSONArray rows = f.getJSONArray("cases");
        assertTrue(rows.length() > 10);
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            assertEquals(r.getString(0), r.getBoolean(2),
                ExternalLink.canLinkOut(r.getString(1), site, Arrays.asList("api.hiveop.io", "api.wenrwa.com")));
        }
    }

    @Test
    public void nullIsNotAllowed() {
        assertEquals(false, ExternalLink.canLinkOut(null, "https://app.hiveop.io", Arrays.asList()));
    }
}
