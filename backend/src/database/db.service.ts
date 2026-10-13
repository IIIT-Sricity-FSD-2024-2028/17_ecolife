import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DataStore } from './types';
import { loadStore, saveStore } from './persistence';

/**
 * The entire "database" for Tropos, in memory, backed by a JSON file so a
 * dev-server restart doesn't wipe everything. Every feature service injects
 * this and reads/writes `db.store.<table>` directly — the same tables a
 * real schema would have (organizations, departments, resourceRecords...).
 *
 * This is deliberately simple rather than routed through a generic
 * find/insert/update abstraction: each service's queries (filters, joins
 * across tables) are just plain array operations, which keeps the business
 * logic readable and is exactly how the course material frames state
 * before introducing a real database.
 */
@Injectable()
export class DbService implements OnApplicationShutdown {
  public readonly store: DataStore;

  constructor() {
    this.store = loadStore();
  }

  /** Call after any mutation to persist the change to data.json. */
  persist(): void {
    saveStore(this.store);
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
    saveStore(this.store);
  }
}
