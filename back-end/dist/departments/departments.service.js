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
exports.DepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let DepartmentsService = class DepartmentsService {
    store;
    constructor(store) {
        this.store = store;
    }
    list() {
        return this.store.list('departments');
    }
    find(id) {
        return this.store.find('departments', id);
    }
    create(dto) {
        return this.store.create('departments', { manager: 'Unassigned', managerUserId: null, target: '0 L', threshold: '0 L', current: '0 L', co2: '0', status: 'Within Target', statusType: 'green', ...dto }, 'dept');
    }
    update(id, dto) {
        return this.store.update('departments', id, dto);
    }
    remove(id) {
        return this.store.remove('departments', id);
    }
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map