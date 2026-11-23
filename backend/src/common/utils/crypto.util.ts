import crypto from 'crypto';
import { getEnv } from '../../config/env.validation';

export function sha256(val: string | Buffer): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export function randomHexToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ---- Secrets at rest (TOTP seeds). AES-256-GCM, key from DATA_ENCRYPTION_KEY (64 hex) or derived from JWT_SECRET. ----
function dataKey(): Buffer {
  const env = getEnv();
  if (env.DATA_ENCRYPTION_KEY) return Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
  return Buffer.from(crypto.hkdfSync('sha256', env.JWT_SECRET, 'tropos-data-at-rest', 'v1', 32));
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', dataKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith('enc:v1:')) return stored; // legacy plaintext value, re-encrypted on next write
  const [, , iv, tag, ct] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', dataKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}
