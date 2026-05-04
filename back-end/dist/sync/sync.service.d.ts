import { InMemoryStoreService } from '../common/in-memory-store.service';
import { RorizonDb } from '../in-memory/entities';
export declare class SyncService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    snapshot(): RorizonDb;
    replace(snapshot: Partial<RorizonDb>): RorizonDb;
}
