import { Injectable } from '@nestjs/common';
import { DepartmentDto, UpdateDepartmentDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Department } from '../in-memory/entities';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly store: InMemoryStoreService,
    private readonly revenueService: RevenueService,
  ) {}

  list() {
    return this.store.list<Department>('departments');
  }

  find(id: string) {
    return this.store.find<Department>('departments', id);
  }

  create(dto: DepartmentDto) {
    if (dto.orgId) {
      this.revenueService.checkLimit(dto.orgId, 'departments');
    }
    return this.store.create<Department>(
      'departments',
      { manager: 'Unassigned', managerUserId: null, target: '0 L', threshold: '0 L', current: '0 L', co2: '0', status: 'Within Target', statusType: 'green', ...dto } as Department,
      'dept',
    );
  }

  update(id: string, dto: UpdateDepartmentDto) {
    return this.store.update<Department>('departments', id, dto as Department);
  }

  remove(id: string) {
    return this.store.remove<Department>('departments', id);
  }
}
