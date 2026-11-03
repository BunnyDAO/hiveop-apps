package io.hiveop.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingConfig;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.GetBillingConfigParams;
import com.android.billingclient.api.PendingPurchasesParams;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * The Play Store country (ISO 3166-1 alpha-2) via Play Billing's billing config. The billing
 * library is here for this one read and nothing else: the app sells nothing through Play
 * (ADR-0002). If Play can't be reached (no Play Store on the device or emulator, no account,
 * offline) the answer is null, and the site treats unknown as non-US. Cached once resolved.
 */
final class Storefront {
    interface Callback {
        void onCountry(String countryOrNull);
    }

    private static final long TIMEOUT_MS = 8000;
    private static volatile boolean resolved;
    private static volatile String cached;

    private Storefront() {}

    /** Valid alpha-2, uppercased; anything else is null. */
    static String normalize(String code) {
        if (code == null) return null;
        String c = code.trim().toUpperCase(Locale.ROOT);
        return c.matches("[A-Z]{2}") ? c : null;
    }

    static void lookup(Context context, Callback callback) {
        if (resolved) {
            callback.onCountry(cached);
            return;
        }
        final Handler main = new Handler(Looper.getMainLooper());
        final AtomicBoolean done = new AtomicBoolean(false);
        final BillingClient[] holder = new BillingClient[1];
        final Callback finish = country -> {
            if (!done.compareAndSet(false, true)) return;
            resolved = true;
            cached = country;
            try {
                if (holder[0] != null) holder[0].endConnection();
            } catch (Exception ignored) {
                // already closed
            }
            callback.onCountry(country);
        };
        main.postDelayed(() -> finish.onCountry(null), TIMEOUT_MS);
        try {
            BillingClient client = BillingClient.newBuilder(context.getApplicationContext())
                .setListener((result, purchases) -> { /* no purchases are ever started */ })
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
            holder[0] = client;
            client.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult result) {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        finish.onCountry(null);
                        return;
                    }
                    client.getBillingConfigAsync(GetBillingConfigParams.newBuilder().build(), (r, config) -> {
                        BillingConfig c = config;
                        finish.onCountry(r.getResponseCode() == BillingClient.BillingResponseCode.OK && c != null
                            ? normalize(c.getCountryCode()) : null);
                    });
                }

                @Override
                public void onBillingServiceDisconnected() {
                    finish.onCountry(null);
                }
            });
        } catch (Exception e) {
            finish.onCountry(null);
        }
    }
}
