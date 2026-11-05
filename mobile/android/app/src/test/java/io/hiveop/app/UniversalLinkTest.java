package io.hiveop.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Runs the shared fixture (mobile/src/fixtures/universalLink.cases.json) through UniversalLink. */
public class UniversalLinkTest {
    @Test
    public void cases() throws Exception {
        JSONObject f = new JSONObject(new String(
            Files.readAllBytes(Paths.get("../../src/fixtures/universalLink.cases.json")), "UTF-8"));
        JSONArray rows = f.getJSONArray("cases");
        assertTrue(rows.length() > 10);
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            Object raw = r.isNull(1) ? null : r.get(1);
            String want = r.isNull(2) ? null : r.getString(2);
            assertEquals(r.getString(0), want, UniversalLink.target(raw, f.getString("siteOrigin")));
        }
    }
}
