import { InMemoryStoreService } from '../common/in-memory-store.service';
export declare class SystemService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    health(): {
        uptime: string;
        uptimeSeconds: number;
        serverLoad: string;
        serverLoadPercent: number;
        heapUsedMb: number;
        heapTotalMb: number;
        rssMb: number;
        measuredAt: string;
    };
    modules(): any[];
    private formatUptime;
}
