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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const crud_types_1 = require("../common/crud.types");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const system_service_1 = require("./system.service");
let SystemController = class SystemController {
    systemService;
    constructor(systemService) {
        this.systemService = systemService;
    }
    health() { return (0, crud_types_1.ok)('System health loaded.', this.systemService.health()); }
    modules() { return (0, crud_types_1.ok)('Modules loaded.', this.systemService.modules()); }
};
exports.SystemController = SystemController;
__decorate([
    (0, common_1.Get)('health'),
    (0, roles_decorator_1.Roles)('Super User'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('modules'),
    (0, roles_decorator_1.Roles)('Super User'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "modules", null);
exports.SystemController = SystemController = __decorate([
    (0, swagger_1.ApiTags)('system'),
    (0, common_1.Controller)('system'),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'Super User only for system health and module status.', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } }),
    __metadata("design:paramtypes", [system_service_1.SystemService])
], SystemController);
//# sourceMappingURL=system.controller.js.map