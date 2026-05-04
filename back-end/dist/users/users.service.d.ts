import { UpdateUserDto, UserDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
import { User } from '../in-memory/entities';
export declare class UsersService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    list(): User[];
    find(id: string): User;
    create(dto: UserDto): User;
    update(id: string, dto: UpdateUserDto): User;
    remove(id: string): User;
}
