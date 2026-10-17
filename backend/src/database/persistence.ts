import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, unlinkSync, statSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { DataStore, createEmptyStore } from './types';

/** Defaults to the existing development store; tests can supply an isolated file. */
export const dataFile = () => process.env.TROPOS_DATA_FILE || join(process.cwd(), 'data.json');
export const backupDir = () => join(dirname(dataFile()), 'backups');

let latestStoreRef: DataStore | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let lastBackupTime = 0;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Safely writes content to targetPath atomically:
 * 1. Writes to a unique temp file.
 * 2. Renames temp file over targetPath with retry logic for Windows file locks (EBUSY/EPERM).
 * 3. Falls back to copyFileSync if rename is blocked by external file handles.
 */
function atomicWrite(targetPath: string, content: string): void {
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tmpFile = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmpFile, content, 'utf-8');

  let renamed = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      renameSync(tmpFile, targetPath);
      renamed = true;
      break;
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        // Short sync delay for Windows file lock release
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
      } else {
        break;
      }
    }
  }

  if (!renamed) {
    try {
      copyFileSync(tmpFile, targetPath);
      unlinkSync(tmpFile);
    } catch {
      // Safe no-op if disk or process is constrained
    }
  }
}

/**
 * Creates a rolling timestamped backup snapshot in backups/ and purges snapshots older than 7 days.
 */
export function createBackupSnapshot(store: DataStore): string | null {
  try {
    const dir = backupDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}`;
    const filename = `data-backup-${stamp}.json`;
    const target = join(dir, filename);

    atomicWrite(target, JSON.stringify(store, null, 2));
    lastBackupTime = Date.now();

    // Clean up backups older than 7 days
    const files = readdirSync(dir);
    const cutoff = Date.now() - BACKUP_RETENTION_MS;
    for (const f of files) {
      if (f.startsWith('data-backup-') && f.endsWith('.json')) {
        const filePath = join(dir, f);
        try {
          const stats = statSync(filePath);
          if (stats.mtimeMs < cutoff) {
            unlinkSync(filePath);
          }
        } catch {
          // ignore cleanup errors
        }
      }
    }

    return target;
  } catch (err) {
    console.error('[Tropos Persistence] Failed to create backup snapshot:', err);
    return null;
  }
}

/**
 * Returns diagnostic metadata about backups for health check endpoints.
 */
export function getBackupStats(): { count: number; lastBackup: string | null; backupDir: string } {
  const dir = backupDir();
  if (!existsSync(dir)) {
    return { count: 0, lastBackup: null, backupDir: dir };
  }
  try {
    const files = readdirSync(dir).filter((f) => f.startsWith('data-backup-') && f.endsWith('.json'));
    let latestTime: Date | null = null;
    for (const f of files) {
      const stats = statSync(join(dir, f));
      if (!latestTime || stats.mtime > latestTime) {
        latestTime = stats.mtime;
      }
    }
    return { count: files.length, lastBackup: latestTime ? latestTime.toISOString() : null, backupDir: dir };
  } catch {
    return { count: 0, lastBackup: null, backupDir: dir };
  }
}

/**
 * Loads the store from data.json if it exists.
 * If data.json is corrupted, it automatically searches the backups directory
 * and recovers the latest valid snapshot rather than wiping data!
 */
export function loadStore(): DataStore {
  const file = dataFile();
  if (existsSync(file)) {
    try {
      const raw = readFileSync(file, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DataStore>;
      const store = { ...createEmptyStore(), ...parsed };
      latestStoreRef = store;

      // Create an initial startup snapshot if none exists or interval elapsed
      if (Date.now() - lastBackupTime > BACKUP_INTERVAL_MS) {
        createBackupSnapshot(store);
      }
      return store;
    } catch (err) {
      console.error('[Tropos Persistence] CRITICAL: data.json parse failed. Initiating disaster recovery from backups...', err);

      // Attempt recovery from backups directory
      const dir = backupDir();
      if (existsSync(dir)) {
        const backups = readdirSync(dir)
          .filter((f) => f.startsWith('data-backup-') && f.endsWith('.json'))
          .sort()
          .reverse();

        for (const backupFile of backups) {
          try {
            const backupPath = join(dir, backupFile);
            const backupRaw = readFileSync(backupPath, 'utf-8');
            const recovered = JSON.parse(backupRaw) as Partial<DataStore>;
            const store = { ...createEmptyStore(), ...recovered };
            console.warn(`[Tropos Persistence] SUCCESS: Recovered platform state from backup: ${backupFile}`);
            atomicWrite(file, JSON.stringify(store, null, 2));
            latestStoreRef = store;
            return store;
          } catch {
            // try next backup
          }
        }
      }

      console.error('[Tropos Persistence] No valid backups found. Initializing empty store.');
      const fallback = createEmptyStore();
      latestStoreRef = fallback;
      return fallback;
    }
  }

  const empty = createEmptyStore();
  latestStoreRef = empty;
  return empty;
}

/**
 * Flushes the in-memory store to disk immediately and synchronously.
 * Called on process shutdown or manual flush.
 */
export function flushStoreSync(store?: DataStore): void {
  const targetStore = store || latestStoreRef;
  if (!targetStore) return;

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    const file = dataFile();
    atomicWrite(file, JSON.stringify(targetStore, null, 2));

    // Periodic backup snapshot if time elapsed
    if (Date.now() - lastBackupTime > BACKUP_INTERVAL_MS) {
      createBackupSnapshot(targetStore);
    }
  } catch (err) {
    console.error('[Tropos Persistence] Failed to flush store synchronously:', err);
  }
}

/**
 * Writes the store to data.json with debouncing (150ms) to bundle rapid writes.
 */
export function saveStore(store: DataStore): void {
  latestStoreRef = store;
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushStoreSync(store);
  }, 150);
}

// Register Node.js process exit hooks once so pending writes are never lost on termination
if (typeof process !== 'undefined') {
  process.on('beforeExit', () => {
    if (latestStoreRef) flushStoreSync(latestStoreRef);
  });
}
