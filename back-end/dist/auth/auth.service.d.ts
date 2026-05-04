import { LoginDto } from '../common/base.dto';
import { InMemoryStoreService } from '../common/in-memory-store.service';
export declare class AuthService {
    private readonly store;
    constructor(store: InMemoryStoreService);
    login(dto: LoginDto): import("../in-memory/entities").User;
}
