import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DataStore } from './types';
import { loadStore, saveStore, flushStoreSync } from './persistence';

/**
 * The entire "database" for Tropos, in memory, backed by a JSON file so a
 * dev-server restart doesn't wipe everything. Every feature service injects
 * this and reads/writes `db.store.<table>` directly — the same tables a
 * real schema would have (organizations, departments, resourceRecords...).
 */
@Injectable()
export class DbService implements OnApplicationShutdown {
  public readonly store: DataStore;

  constructor() {
    this.store = loadStore();
  }

  /** Call after any mutation to persist the change to data.json with debouncing. */
  persist(): void {
    saveStore(this.store);
  }

  /** Flushes changes to disk immediately and synchronously. */
  flush(): void {
    flushStoreSync(this.store);
  }

  /** Generates a new record id. */
  id(): string {
    return uuidv4();
  }

  /** Current timestamp in ISO 8601 (UTC) — the one place "now" is produced,
   * so date handling stays consistent across every service. */
  now(): string {
    return new Date().toISOString();
  }

  onApplicationShutdown() {
    flushStoreSync(this.store);
  }
}
