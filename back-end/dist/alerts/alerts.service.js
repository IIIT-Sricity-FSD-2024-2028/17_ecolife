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
exports.AlertsService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let AlertsService = class AlertsService {
    store;
    constructor(store) {
        this.store = store;
    }
    list() {
        return this.store.list('alerts');
    }
    find(id) {
        return this.store.find('alerts', id);
    }
    create(dto) {
        return this.store.create('alerts', { roleScope: ['Manager', 'COO'], deviationReason: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...dto }, 'alt');
    }
    update(id, dto) {
        return this.store.update('alerts', id, dto);
    }
    respond(id, response) {
        return this.store.respondToAlert(id, response);
    }
    remove(id) {
        return this.store.remove('alerts', id);
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map