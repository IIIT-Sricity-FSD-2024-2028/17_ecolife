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
exports.SystemService = void 0;
const common_1 = require("@nestjs/common");
const in_memory_store_service_1 = require("../common/in-memory-store.service");
let SystemService = class SystemService {
    store;
    constructor(store) {
        this.store = store;
    }
    health() {
        const uptimeSeconds = process.uptime();
        const memory = process.memoryUsage();
        const heapLoad = memory.heapTotal > 0 ? Math.min((memory.heapUsed / memory.heapTotal) * 100, 100) : 0;
        const rssLoad = Math.min((memory.rss / (256 * 1024 * 1024)) * 100, 100);
        const serverLoad = Math.round((heapLoad * 0.7) + (rssLoad * 0.3));
        return {
            uptime: this.formatUptime(uptimeSeconds),
            uptimeSeconds: Math.round(uptimeSeconds),
            serverLoad: `${serverLoad}%`,
            serverLoadPercent: serverLoad,
            heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
            rssMb: Math.round(memory.rss / 1024 / 1024),
            measuredAt: new Date().toISOString(),
        };
    }
    modules() {
        return this.store.snapshot().modules;
    }
    formatUptime(totalSeconds) {
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if (days > 0)
            return `${days}d ${hours}h ${minutes}m`;
        if (hours > 0)
            return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
};
exports.SystemService = SystemService;
exports.SystemService = SystemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [in_memory_store_service_1.InMemoryStoreService])
], SystemService);
//# sourceMappingURL=system.service.js.map