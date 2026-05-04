export declare const ROLES_KEY = "roles";
export type Role = 'Super User' | 'COO' | 'Manager' | 'Analyst';
export declare const Roles: (...roles: Role[]) => import("@nestjs/common").CustomDecorator<string>;
