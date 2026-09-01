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
    const org = this.store.create<Organization>(
      'organizations',
      { departmentIds: [], current: '0 L', co2: '0', status: 'Within Target', statusType: 'green', registrationStatus: 'Approved', registrationStatusType: 'green', cooName: '', cooUserId: null, cooEmail: '', target: '0 L', threshold: '0 L', ...dto } as Organization,
      'org',
    );
    try {
      const existingSub = this.store.list<any>('subscriptions').find((s: any) => s.organizationId === org.id);
      if (!existingSub) {
        this.store.create<any>('subscriptions', {
          id: `sub-${org.id}`,
          organizationId: org.id,
          planId: 'plan-pro',
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          addonIds: [],
          startDate: new Date().toISOString().slice(0, 10),
          renewalDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, 'sub');
      }
    } catch (_) {}
    return org;
  }

  update(id: string, dto: UpdateOrganizationDto) {
    return this.store.update<Organization>('organizations', id, dto as Organization);
  }

  remove(id: string) {
    return this.store.remove<Organization>('organizations', id);
  }
}
