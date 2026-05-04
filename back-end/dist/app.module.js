"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const api_logger_middleware_1 = require("./common/middleware/api-logger.middleware");
const roles_guard_1 = require("./common/guards/roles.guard");
const common_module_1 = require("./common/common.module");
const sync_module_1 = require("./sync/sync.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const organizations_module_1 = require("./organizations/organizations.module");
const departments_module_1 = require("./departments/departments.module");
const submissions_module_1 = require("./submissions/submissions.module");
const reports_module_1 = require("./reports/reports.module");
const alerts_module_1 = require("./alerts/alerts.module");
const notifications_module_1 = require("./notifications/notifications.module");
const audit_module_1 = require("./audit/audit.module");
const system_module_1 = require("./system/system.module");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(api_logger_middleware_1.ApiLoggerMiddleware).forRoutes('{*path}');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            common_module_1.CommonModule,
            sync_module_1.SyncModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            organizations_module_1.OrganizationsModule,
            departments_module_1.DepartmentsModule,
            submissions_module_1.SubmissionsModule,
            reports_module_1.ReportsModule,
            alerts_module_1.AlertsModule,
            notifications_module_1.NotificationsModule,
            audit_module_1.AuditModule,
            system_module_1.SystemModule,
        ],
        providers: [{ provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard }],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map