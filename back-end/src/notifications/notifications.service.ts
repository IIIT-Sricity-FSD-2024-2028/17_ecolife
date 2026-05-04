import { Injectable } from '@nestjs/common';
import { NotificationDto, UpdateNotificationDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { NotificationItem } from '../in-memory/entities';
import { Role } from '../common/decorators/roles.decorator';

@Injectable()
export class NotificationsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list(role?: Role) {
    const notifications = this.store.list<NotificationItem>('notifications');
    if (!role || role === 'Super User') return notifications;
    return notifications.filter((notification) => notification.role === role);
  }

  find(id: string) {
    return this.store.find<NotificationItem>('notifications', id);
  }

  create(dto: NotificationDto) {
    return this.store.create<NotificationItem>(
      'notifications',
      { timestamp: 'Just now', read: false, details: '', ...dto } as NotificationItem,
      'ntf',
    );
  }

  update(id: string, dto: UpdateNotificationDto) {
    return this.store.update<NotificationItem>('notifications', id, dto as NotificationItem);
  }

  remove(id: string) {
    return this.store.remove<NotificationItem>('notifications', id);
  }
}
