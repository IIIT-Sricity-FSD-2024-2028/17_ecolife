import { SystemService } from './system.service';
export declare class SystemController {
    private readonly systemService;
    constructor(systemService: SystemService);
    health(): import("../common/crud.types").ApiResponse<{
        uptime: string;
        uptimeSeconds: number;
        serverLoad: string;
        serverLoadPercent: number;
        heapUsedMb: number;
        heapTotalMb: number;
        rssMb: number;
        measuredAt: string;
    }>;
    modules(): import("../common/crud.types").ApiResponse<any[]>;
}
