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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let NotificationsService = class NotificationsService {
    store;
    constructor(store) {
        this.store = store;
    }
    list(role) {
        const notifications = this.store.list('notifications');
        if (!role || role === 'Super User')
            return notifications;
        return notifications.filter((notification) => notification.role === role);
    }
    find(id) {
        return this.store.find('notifications', id);
    }
    create(dto) {
        return this.store.create('notifications', { timestamp: 'Just now', read: false, details: '', ...dto }, 'ntf');
    }
    update(id, dto) {
        return this.store.update('notifications', id, dto);
    }
    remove(id) {
        return this.store.remove('notifications', id);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map