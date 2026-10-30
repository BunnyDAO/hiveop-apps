import { describe, expect, it, vi } from 'vitest';
import { checkMedia, requestMedia, type MediaAccessDeps, type OsMediaStatus } from './mediaAccess';

function deps(mic: OsMediaStatus, camera: OsMediaStatus = 'not-determined', answer = true) {
  const ask = vi.fn(async () => answer);
  const d: MediaAccessDeps = { status: (dev) => (dev === 'microphone' ? mic : camera), ask };
  return { d, ask };
}

describe('mediaAccess — the site sees macOS’s real mic setting', () => {
  it('a mic check is not granted until macOS has said yes (so a hover never prompts)', () => {
    expect(checkMedia(deps('not-determined').d, 'media', 'audio')).toBe(false);
    expect(checkMedia(deps('denied').d, 'media', 'audio')).toBe(false);
    expect(checkMedia(deps('granted').d, 'media', 'audio')).toBe(true);
  });

  it('a camera check reads the camera, not the mic', () => {
    expect(checkMedia(deps('granted', 'denied').d, 'media', 'video')).toBe(false);
    expect(checkMedia(deps('denied', 'granted').d, 'media', 'video')).toBe(true);
  });

  it('a media check with no device type is not granted; other permissions keep the default', () => {
    expect(checkMedia(deps('granted').d, 'media')).toBe(false);
    expect(checkMedia(deps('denied').d, 'clipboard-sanitized-write')).toBe(true);
  });

  it('a click asks macOS once per device and passes its answer through', async () => {
    const yes = deps('not-determined');
    expect(await requestMedia(yes.d, 'media', ['audio'])).toBe(true);
    expect(yes.ask).toHaveBeenCalledTimes(1);
    expect(yes.ask).toHaveBeenCalledWith('microphone');

    const no = deps('not-determined', 'not-determined', false);
    expect(await requestMedia(no.d, 'media', ['audio', 'video'])).toBe(false);
    expect(no.ask).toHaveBeenCalledTimes(1);
  });

  it('non-media requests are untouched', async () => {
    const { d, ask } = deps('denied');
    expect(await requestMedia(d, 'fullscreen')).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});
