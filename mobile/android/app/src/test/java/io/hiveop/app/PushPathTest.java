package io.hiveop.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.nio.file.Files;
import java.nio.file.Paths;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/** Runs the shared fixture (mobile/src/fixtures/pushPath.cases.json) through PushPath. */
public class PushPathTest {
    private static JSONObject load() throws Exception {
        return new JSONObject(new String(Files.readAllBytes(Paths.get("../../src/fixtures/pushPath.cases.json")), "UTF-8"));
    }

    private static Object raw(JSONArray row) throws Exception {
        return row.isNull(1) ? null : row.get(1);
    }

    @Test
    public void sanitizeCases() throws Exception {
        JSONArray rows = load().getJSONArray("cases");
        assertTrue(rows.length() > 10);
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            assertEquals(r.getString(0), r.getString(2), PushPath.sanitize(raw(r)));
        }
    }

    @Test
    public void urlCases() throws Exception {
        JSONObject f = load();
        JSONArray rows = f.getJSONArray("urls");
        for (int i = 0; i < rows.length(); i++) {
            JSONArray r = rows.getJSONArray(i);
            assertEquals(r.getString(0), r.getString(2), PushPath.targetUrl(raw(r), f.getString("siteOrigin")));
        }
    }
}
