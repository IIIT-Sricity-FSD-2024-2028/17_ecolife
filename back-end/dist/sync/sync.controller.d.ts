import { SnapshotDto } from '../common/base.dto';
import { RorizonDb } from '../in-memory/entities';
import { SyncService } from './sync.service';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
    getSnapshot(): import("../common/crud.types").ApiResponse<RorizonDb>;
    replaceSnapshot(body: SnapshotDto): import("../common/crud.types").ApiResponse<RorizonDb>;
}
