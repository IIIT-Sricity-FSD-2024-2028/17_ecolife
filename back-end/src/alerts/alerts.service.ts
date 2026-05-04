import { Injectable } from '@nestjs/common';
import { AlertDto, UpdateAlertDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Alert } from '../in-memory/entities';

@Injectable()
export class AlertsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<Alert>('alerts');
  }

  find(id: string) {
    return this.store.find<Alert>('alerts', id);
  }

  create(dto: AlertDto) {
    return this.store.create<Alert>(
      'alerts',
      { roleScope: ['Manager', 'COO'], deviationReason: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...dto } as Alert,
      'alt',
    );
  }

  update(id: string, dto: UpdateAlertDto) {
    return this.store.update<Alert>('alerts', id, dto as Alert);
  }

  respond(id: string, response: string) {
    return this.store.respondToAlert(id, response);
  }

  remove(id: string) {
    return this.store.remove<Alert>('alerts', id);
  }
}
