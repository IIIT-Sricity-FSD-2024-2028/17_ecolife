import { ForbiddenException, Injectable } from '@nestjs/common';
import { UpdateUserDto, UserDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { User } from '../in-memory/entities';
import { RevenueService } from '../revenue/revenue.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly store: InMemoryStoreService,
    private readonly revenueService: RevenueService,
  ) {}

  list() {
    return this.store.list<User>('users');
  }

  find(id: string) {
    return this.store.find<User>('users', id);
  }

  create(dto: UserDto) {
    if (dto.organizationId) {
      this.revenueService.checkLimit(dto.organizationId, 'users');
    }
    return this.store.create<User>(
      'users',
      { status: 'Active', department: '', departmentId: '', assignedDepartmentIds: [], organizationId: '', phone: '', lastLogin: '--', ...dto } as User,
      'usr',
    );
  }

  update(id: string, dto: UpdateUserDto, actorRole = '', actorId = '') {
    if (actorRole !== 'Super User' && actorRole !== 'COO') {
      if (!actorId || String(actorId) !== String(id)) {
        throw new ForbiddenException('You can update only your own profile.');
      }
      const allowedSelfUpdate: UpdateUserDto = {};
      if (dto.name !== undefined) allowedSelfUpdate.name = dto.name;
      if (dto.phone !== undefined) allowedSelfUpdate.phone = dto.phone;
      if (dto.password !== undefined) allowedSelfUpdate.password = dto.password;
      return this.store.update<User>('users', id, allowedSelfUpdate as User);
    }
    return this.store.update<User>('users', id, dto as User);
  }

  remove(id: string) {
    const user = this.store.find<User>('users', id);
    if (user.role === 'COO' && user.organizationId) {
      const orgId = user.organizationId;
      const state = this.store.snapshot();
      state.users = state.users.filter((u) => u.organizationId !== orgId && String(u.id) !== String(id));
      state.departments = state.departments.filter((d) => d.orgId !== orgId);
      state.organizations = state.organizations.filter((o) => o.id !== orgId);
      state.submissions = state.submissions.filter((s) => s.organizationId !== orgId);
      state.alerts = state.alerts.filter((a) => a.organizationId !== orgId);
      this.store.replace(state);
      return user;
    }
    return this.store.remove<User>('users', id);
  }
}
