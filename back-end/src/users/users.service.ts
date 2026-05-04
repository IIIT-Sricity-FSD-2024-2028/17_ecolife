import { Injectable } from '@nestjs/common';
import { UpdateUserDto, UserDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { User } from '../in-memory/entities';

@Injectable()
export class UsersService {
  constructor(private readonly store: InMemoryStoreService) {}

  list() {
    return this.store.list<User>('users');
  }

  find(id: string) {
    return this.store.find<User>('users', id);
  }

  create(dto: UserDto) {
    return this.store.create<User>(
      'users',
      { status: 'Active', department: '', departmentId: '', assignedDepartmentIds: [], organizationId: '', phone: '', lastLogin: '--', ...dto } as User,
      'usr',
    );
  }

  update(id: string, dto: UpdateUserDto) {
    return this.store.update<User>('users', id, dto as User);
  }

  remove(id: string) {
    return this.store.remove<User>('users', id);
  }
}
