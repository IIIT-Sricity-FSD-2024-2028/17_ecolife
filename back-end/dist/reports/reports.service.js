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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let ReportsService = class ReportsService {
    store;
    constructor(store) {
        this.store = store;
    }
    list() {
        return this.store.list('reports');
    }
    find(id) {
        return this.store.find('reports', id);
    }
    create(dto) {
        return this.store.create('reports', { date: new Date().toLocaleDateString(), status: 'Pending Review', statusClass: 'amber', analystName: 'Analyst', analystUserId: null, signature: { signedBy: 'Analyst', signedAt: new Date().toISOString() }, revision: { required: false, comment: '', requestedBy: '', requestedAt: '' }, content: {}, ...dto }, 'rpt');
    }
    update(id, dto) {
        return this.store.update('reports', id, dto);
    }
    approve(id, approvedBy) {
        return this.store.approveReport(id, approvedBy || 'COO');
    }
    requestRevision(id, comment, requestedBy) {
        return this.store.requestReportRevision(id, comment, requestedBy || 'COO');
    }
    remove(id) {
        return this.store.remove('reports', id);
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], ReportsService);
//# sourceMappingURL=reports.service.js.map