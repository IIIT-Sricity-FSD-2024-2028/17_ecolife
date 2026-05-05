import { UpdateUserDto, UserDto } from '../common/base.dto';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    list(): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User[]>;
    find(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
    create(dto: UserDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
    update(id: string, dto: UpdateUserDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
    replace(id: string, dto: UpdateUserDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
    remove(id: string): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
}
