import { NotificationDto, UpdateNotificationDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { NotificationItem } from '../in-memory/entities';
import { Role } from '../common/decorators/roles.decorator';
export declare class NotificationsService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(role?: Role): NotificationItem[];
    find(id: string): NotificationItem;
    create(dto: NotificationDto): NotificationItem;
    update(id: string, dto: UpdateNotificationDto): NotificationItem;
    remove(id: string): NotificationItem;
}
