/**
 * Reference rule for the native WebView media gate (mic/camera). Pure; the Android client
 * (MediaPolicy.java) and the iOS delegate (MediaGate.swift) implement the same rule, and
 * both read src/fixtures/mediaOrigin.cases.json in tests / are checked against it.
 *
 * Rule (mirrors desktop/src/mediaAccess.ts): getUserMedia is answered only for the site
 * origin, and only the capture resources (audio/video). The OS grant comes second: the
 * request is never granted to the page unless the operating system has said yes.
 */
export type MediaResource = 'audio' | 'video';

export function isSiteOrigin(requestOrigin: string, siteOrigin: string): boolean {
  let req: URL;
  let site: URL;
  try {
    req = new URL(requestOrigin);
    site = new URL(siteOrigin);
  } catch {
    return false;
  }
  if (req.protocol !== 'http:' && req.protocol !== 'https:') return false;
  if (req.username || req.password) return false;
  return req.origin === site.origin;
}

export function mediaRequestAllowed(requestOrigin: string, siteOrigin: string, resources: readonly string[]): boolean {
  if (resources.length === 0) return false;
  if (!resources.every((r) => r === 'audio' || r === 'video')) return false;
  return isSiteOrigin(requestOrigin, siteOrigin);
}

/** iOS Info.plist / Android rationale strings. Kept here so a test holds them short. */
export const MIC_CAMERA_USAGE = {
  microphone: 'HiveOp uses the microphone for dictation and voice.',
  camera: 'HiveOp uses the camera for photos you choose to share.',
  photoLibrary: 'HiveOp lets you pick photos to upload.',
} as const;
