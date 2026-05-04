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
exports.SyncController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const base_dto_1 = require("../common/base.dto");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const crud_types_1 = require("../common/crud.types");
const sync_service_1 = require("./sync.service");
let SyncController = class SyncController {
    syncService;
    constructor(syncService) {
        this.syncService = syncService;
    }
    getSnapshot() {
        return (0, crud_types_1.ok)('Database snapshot loaded.', this.syncService.snapshot());
    }
    replaceSnapshot(body) {
        return (0, crud_types_1.ok)('Database snapshot synchronized.', this.syncService.replace(body));
    }
};
exports.SyncController = SyncController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Read the full in-memory runtime snapshot for frontend synchronization.' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'Any active role can read its synchronized UI state.', required: false }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "getSnapshot", null);
__decorate([
    (0, common_1.Put)('snapshot'),
    (0, roles_decorator_1.Roles)('Super User', 'COO', 'Manager', 'Analyst'),
    (0, swagger_1.ApiOperation)({ summary: 'Replace in-memory runtime snapshot after a UI workflow updates state.' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'Role performing the synchronization write.', required: true }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [base_dto_1.SnapshotDto]),
    __metadata("design:returntype", void 0)
], SyncController.prototype, "replaceSnapshot", null);
exports.SyncController = SyncController = __decorate([
    (0, swagger_1.ApiTags)('database snapshot'),
    (0, common_1.Controller)('db'),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Standard response format.', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object' } } } }),
    __metadata("design:paramtypes", [sync_service_1.SyncService])
], SyncController);
//# sourceMappingURL=sync.controller.js.map