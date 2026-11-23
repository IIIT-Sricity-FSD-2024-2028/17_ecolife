import fs from 'fs';
import path from 'path';
import { getEnv } from '../../config/env.validation';

/**
 * Where uploaded files live. 'local' keeps them in UPLOAD_DIR (fine for one server).
 * 'supabase' keeps them in Supabase Storage so any number of servers can serve them and a restart loses nothing.
 */
const provider = () => getEnv().STORAGE_PROVIDER;
const base = () => `${getEnv().SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(getEnv().SUPABASE_STORAGE_BUCKET)}`;
const enc = (key: string) => key.split('/').map(encodeURIComponent).join('/');
const auth = () => ({ Authorization: `Bearer ${getEnv().SUPABASE_SERVICE_ROLE_KEY}` });

export async function putFile(key: string, buffer: Buffer, mime: string): Promise<void> {
  if (provider() === 'supabase') {
    const res = await fetch(`${base()}/${enc(key)}`, { method: 'POST', headers: { ...auth(), 'Content-Type': mime, 'x-upsert': 'false' }, body: new Uint8Array(buffer), signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`File storage refused the upload (${res.status}).`);
    return;
  }
  const full = path.join(path.resolve(getEnv().UPLOAD_DIR), key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buffer);
}

/** The file's bytes, or null when it is not there. */
export async function getFile(key: string): Promise<Buffer | null> {
  if (provider() === 'supabase') {
    const res = await fetch(`${base()}/${enc(key)}`, { headers: auth(), signal: AbortSignal.timeout(30000) });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`File storage could not be read (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  const full = path.join(path.resolve(getEnv().UPLOAD_DIR), key);
  return fs.existsSync(full) ? fs.readFileSync(full) : null;
}
