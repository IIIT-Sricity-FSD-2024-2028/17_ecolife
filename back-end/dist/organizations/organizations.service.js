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
exports.OrganizationsService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let OrganizationsService = class OrganizationsService {
    store;
    constructor(store) {
        this.store = store;
    }
    list() {
        return this.store.list('organizations');
    }
    find(id) {
        return this.store.find('organizations', id);
    }
    create(dto) {
        return this.store.create('organizations', { departmentIds: [], current: '0 L', co2: '0', status: 'Within Target', statusType: 'green', registrationStatus: 'Approved', registrationStatusType: 'green', cooName: '', cooUserId: null, cooEmail: '', target: '0 L', threshold: '0 L', ...dto }, 'org');
    }
    update(id, dto) {
        return this.store.update('organizations', id, dto);
    }
    remove(id) {
        return this.store.remove('organizations', id);
    }
};
exports.OrganizationsService = OrganizationsService;
exports.OrganizationsService = OrganizationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], OrganizationsService);
//# sourceMappingURL=organizations.service.js.map