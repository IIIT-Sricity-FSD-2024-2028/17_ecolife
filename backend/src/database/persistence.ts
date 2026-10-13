import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { DataStore, createEmptyStore } from './types';

const DATA_FILE = join(process.cwd(), 'data.json');

/**
 * Loads the store from data.json if it exists, otherwise starts empty.
 * This is what lets a `start:dev` restart during frontend development pick
 * up where you left off, instead of wiping every org/user/submission on
 * every single code change like a purely in-RAM store would.
 */
export function loadStore(): DataStore {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DataStore>;
      // Merge onto a fresh empty store so a newly added entity/array in code
      // doesn't crash on an older data.json that predates it.
      return { ...createEmptyStore(), ...parsed };
    } catch (err) {
      console.error('Failed to parse data.json, starting with an empty store:', err);
      return createEmptyStore();
    }
  }
  return createEmptyStore();
}

let saveTimer: NodeJS.Timeout | null = null;

/**
 * Writes the store to data.json. Debounced slightly so a burst of writes
 * (e.g. a CSV import creating dozens of records) doesn't hit the disk once
 * per record. Writes to a temp file then renames, so a crash mid-write
 * never leaves a corrupted data.json behind.
 */
export function saveStore(store: DataStore): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmpFile = `${DATA_FILE}.tmp`;
    writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf-8');
    renameSync(tmpFile, DATA_FILE);
  }, 150);
}
