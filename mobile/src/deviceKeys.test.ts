import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBridgeScript } from './shellBridge';

/**
 * ryc-09: the page script and both native channels must agree on the device-key methods, and
 * each platform must declare what the biometric prompt needs. (The Swift is type-checked by
 * scripts/check-device-keys-swift.sh; the Java needs an Android build — HITL.)
 */
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const METHODS = ['deviceKeyAvailable', 'deviceKeyCreate', 'deviceKeySign', 'deviceKeyRemove'];

describe('device-keys wiring', () => {
  const script = buildBridgeScript({ siteOrigin: 'https://app.hiveop.io', version: '1', platform: 'ios' });
  const swift = read('ios/App/App/HiveOpShell.swift');
  const java = read('android/app/src/main/java/io/hiveop/app/HiveOpShell.java');

  it.each(METHODS)('%s is called by the page and answered on iOS and Android', (m) => {
    expect(script).toContain(`"${m}"`);
    expect(swift).toContain(`"${m}"`);
    expect(java).toContain(`"${m}"`);
  });

  it('the unlock key is biometric-only and void on re-enrolment, on both platforms', () => {
    expect(swift).toMatch(/flags\.insert\(\.biometryCurrentSet\)/);
    expect(swift).toContain('kSecAttrTokenIDSecureEnclave');
    const dk = read('android/app/src/main/java/io/hiveop/app/DeviceKeys.java');
    expect(dk).toContain('setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)');
    expect(dk).toContain('setInvalidatedByBiometricEnrollment(true)');
  });

  it('declares the prompt: NSFaceIDUsageDescription (iOS), USE_BIOMETRIC (Android)', () => {
    expect(read('ios/App/App/Info.plist')).toMatch(/<key>NSFaceIDUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain('android.permission.USE_BIOMETRIC');
  });
});
