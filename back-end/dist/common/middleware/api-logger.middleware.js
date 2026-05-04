"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiLoggerMiddleware = void 0;
const common_1 = require("@nestjs/common");
let ApiLoggerMiddleware = class ApiLoggerMiddleware {
    use(req, res, next) {
        const startedAt = Date.now();
        res.on('finish', () => {
            console.log(`[API] ${req.method} ${req.originalUrl} role=${req.header('x-role') || 'none'} status=${res.statusCode} ${Date.now() - startedAt}ms`);
        });
        next();
    }
};
exports.ApiLoggerMiddleware = ApiLoggerMiddleware;
exports.ApiLoggerMiddleware = ApiLoggerMiddleware = __decorate([
    (0, common_1.Injectable)()
], ApiLoggerMiddleware);
//# sourceMappingURL=api-logger.middleware.js.map