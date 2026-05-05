import { LoginDto } from '../common/base.dto';
import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): import("../common/crud.types").ApiResponse<import("../in-memory/entities").User>;
}
