import { AlertDto, AlertResponseDto, UpdateAlertDto } from '../common/base.dto';
import { AlertsService } from './alerts.service';
export declare class AlertsController {
    private readonly alertsService;
    constructor(alertsService: AlertsService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
    create(dto: AlertDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
    update(id: string, dto: UpdateAlertDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
    replace(id: string, dto: UpdateAlertDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
    respond(id: string, dto: AlertResponseDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").Alert>;
}
