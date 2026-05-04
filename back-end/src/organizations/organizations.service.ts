import { Injectable } from '@nestjs/common';
import { OrganizationDto, UpdateOrganizationDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { Organization } from '../in-memory/entities';

@Injectable()
export class OrganizationsService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<Organization>('organizations');
  }

  find(id: string) {
    return this.store.find<Organization>('organizations', id);
  }

  create(dto: OrganizationDto) {
    return this.store.create<Organization>(
      'organizations',
      { departmentIds: [], current: '0 L', co2: '0', status: 'Within Target', statusType: 'green', registrationStatus: 'Approved', registrationStatusType: 'green', cooName: '', cooUserId: null, cooEmail: '', target: '0 L', threshold: '0 L', ...dto } as Organization,
      'org',
    );
  }

  update(id: string, dto: UpdateOrganizationDto) {
    return this.store.update<Organization>('organizations', id, dto as Organization);
  }

  remove(id: string) {
    return this.store.remove<Organization>('organizations', id);
  }
}
