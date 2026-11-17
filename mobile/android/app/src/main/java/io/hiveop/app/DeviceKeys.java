package io.hiveop.app;

import android.app.Activity;
import android.content.Context;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.math.BigInteger;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.concurrent.Executor;

/**
 * ryc-09 (site PRD reach-your-computer D9): P-256 keys in the Android Keystore, for the site's
 * "Reach your computer" viewer. Two fixed aliases: {@code device} (signs without a prompt) and
 * {@code unlock} (every signature needs a strong biometric; void when biometrics change). Private
 * keys never leave the keystore; the page gets the raw public point and DER signatures.
 *
 * Platform BiometricPrompt (API 30+ for the unlock key), so no new dependency.
 */
final class DeviceKeys {
    static final int MAX_DATA = 4096;
    private static final String STORE = "AndroidKeyStore";

    interface Result {
        void ok(byte[] value);
        void fail(String message);
    }

    private DeviceKeys() {}

    static boolean validAlias(String alias) {
        return "device".equals(alias) || "unlock".equals(alias);
    }

    private static String keyAlias(String alias) {
        return "io.hiveop.app.ryc." + alias;
    }

    /** A strong biometric is enrolled and the unlock key can be made (Android 11+). */
    static boolean available(Context context) {
        if (Build.VERSION.SDK_INT < 30) return false;
        BiometricManager bm = context.getSystemService(BiometricManager.class);
        return bm != null
            && bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /** The raw uncompressed public point (65 bytes), making the key on first use. */
    static byte[] create(Context context, String alias) throws Exception {
        if (!validAlias(alias)) throw new IllegalArgumentException("unknown alias");
        KeyStore ks = KeyStore.getInstance(STORE);
        ks.load(null);
        String ka = keyAlias(alias);
        if (!ks.containsAlias(ka)) {
            KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(ka, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256);
            if ("unlock".equals(alias)) {
                if (!available(context)) throw new IllegalStateException("biometrics unavailable");
                b.setUserAuthenticationRequired(true)
                    .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
                    .setInvalidatedByBiometricEnrollment(true);
            }
            KeyPairGenerator g = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, STORE);
            g.initialize(b.build());
            g.generateKeyPair();
        }
        return rawPoint((ECPublicKey) ks.getCertificate(ka).getPublicKey());
    }

    static byte[] rawPoint(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        copy32(key.getW().getAffineX(), out, 1);
        copy32(key.getW().getAffineY(), out, 33);
        return out;
    }

    private static void copy32(BigInteger v, byte[] out, int off) {
        byte[] b = v.toByteArray(); // big-endian, maybe a leading 0x00 or shorter than 32
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, off + 32 - len, len);
    }

    /** ECDSA P-256 SHA-256 over {@code data}, DER. For {@code unlock} this shows the biometric prompt. */
    static void sign(Activity activity, String alias, byte[] data, String reason, Result result) {
        Result r = once(result);
        try {
            if (!validAlias(alias) || data.length == 0 || data.length > MAX_DATA) { r.fail("bad request"); return; }
            KeyStore ks = KeyStore.getInstance(STORE);
            ks.load(null);
            PrivateKey pk = (PrivateKey) ks.getKey(keyAlias(alias), null);
            if (pk == null) { r.fail("no key"); return; }
            Signature s = Signature.getInstance("SHA256withECDSA");
            s.initSign(pk);
            if (!"unlock".equals(alias)) {
                s.update(data);
                r.ok(s.sign());
                return;
            }
            if (Build.VERSION.SDK_INT < 30) { r.fail("biometrics unavailable"); return; }
            Executor main = activity.getMainExecutor();
            BiometricPrompt prompt = new BiometricPrompt.Builder(activity)
                .setTitle(reason)
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButton("Cancel", main, (dialog, which) -> r.fail("cancelled"))
                .build();
            activity.runOnUiThread(() -> prompt.authenticate(new BiometricPrompt.CryptoObject(s), new CancellationSignal(), main,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult auth) {
                        try {
                            Signature signed = auth.getCryptoObject().getSignature();
                            signed.update(data);
                            r.ok(signed.sign());
                        } catch (Exception e) {
                            r.fail("sign failed");
                        }
                    }

                    @Override
                    public void onAuthenticationError(int code, CharSequence message) {
                        r.fail("cancelled");
                    }
                }));
        } catch (Exception e) {
            r.fail("sign failed");
        }
    }

    /** The prompt's cancel button and its error callback can both fire: answer the page once. */
    static Result once(Result r) {
        java.util.concurrent.atomic.AtomicBoolean done = new java.util.concurrent.atomic.AtomicBoolean();
        return new Result() {
            @Override public void ok(byte[] value) { if (done.compareAndSet(false, true)) r.ok(value); }
            @Override public void fail(String message) { if (done.compareAndSet(false, true)) r.fail(message); }
        };
    }

    static void remove(String alias) throws Exception {
        if (!validAlias(alias)) return;
        KeyStore ks = KeyStore.getInstance(STORE);
        ks.load(null);
        ks.deleteEntry(keyAlias(alias));
    }
}
