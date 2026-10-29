// Connect-token storage (dsk-10). The token is encrypted with the OS (Electron
// safeStorage, injected here as a Cipher) and lives only in this file, never in
// logs or plists. If OS encryption is unavailable we store nothing.
import fs from 'node:fs';
import path from 'node:path';

export interface Cipher {
  available(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export function isConnectToken(v: unknown): v is string {
  return typeof v === 'string' && /^wm_ct_\S+$/.test(v) && v.length <= 512;
}

export interface TokenStore {
  get(): string | undefined;
  has(): boolean;
  set(token: string): boolean;
  clear(): void;
}

export function createTokenStore(file: string, cipher: Cipher): TokenStore {
  const get = (): string | undefined => {
    try {
      const t = cipher.decrypt(fs.readFileSync(file));
      return isConnectToken(t) ? t : undefined;
    } catch {
      return undefined;
    }
  };
  return {
    get,
    has: () => get() !== undefined,
    set(token) {
      if (!isConnectToken(token) || !cipher.available()) return false;
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, cipher.encrypt(token), { mode: 0o600 });
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      fs.rmSync(file, { force: true });
    },
  };
}
