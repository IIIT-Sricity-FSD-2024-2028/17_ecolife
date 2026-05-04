import { NotificationDto, UpdateNotificationDto } from '../common/base.dto';
import { Role } from '../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    list(role: Role): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem>;
    create(dto: NotificationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem>;
    update(id: string, dto: UpdateNotificationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem>;
    replace(id: string, dto: UpdateNotificationDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").NotificationItem>;
}
