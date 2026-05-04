"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const base_dto_1 = require("../common/base.dto");
const crud_types_1 = require("../common/crud.types");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    list() { return (0, crud_types_1.ok)('Users loaded.', this.usersService.list()); }
    find(id) { return (0, crud_types_1.ok)('User loaded.', this.usersService.find(id)); }
    create(dto) { return (0, crud_types_1.ok)('User created.', this.usersService.create(dto)); }
    update(id, dto) { return (0, crud_types_1.ok)('User updated.', this.usersService.update(id, dto)); }
    replace(id, dto) { return (0, crud_types_1.ok)('User updated.', this.usersService.update(id, dto)); }
    remove(id) { return (0, crud_types_1.ok)('User deleted.', this.usersService.remove(id)); }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('Super User', 'COO'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('Super User', 'COO'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "find", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('Super User', 'COO'),
    (0, swagger_1.ApiOperation)({ summary: 'Create user account.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [base_dto_1.UserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('Super User', 'COO', 'Manager', 'Analyst'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, base_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('Super User', 'COO', 'Manager', 'Analyst'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, base_dto_1.UpdateUserDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "replace", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('Super User', 'COO'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, common_1.Controller)('users'),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'Super User for full CRUD; COO can read staff.', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } }),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map