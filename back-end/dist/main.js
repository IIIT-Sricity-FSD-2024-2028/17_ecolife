"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const express = require("express");
const app_module_1 = require("./app.module");
async function createApp() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use('/front-end', express.static((0, node_path_1.join)(process.cwd(), '..', 'front-end')));
    app.setGlobalPrefix('api');
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Rorizon Review-4 API')
        .setDescription('NestJS in-memory backend with RBAC role headers for Rorizon workflows.')
        .setVersion('1.0')
        .addApiKey({
        type: 'apiKey',
        name: 'x-role',
        in: 'header',
        description: 'Role for RBAC authorization. Allowed values: Super User, COO, Manager, Analyst.',
    }, 'role')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    const docsDir = (0, node_path_1.join)(process.cwd(), 'docs');
    (0, node_fs_1.mkdirSync)(docsDir, { recursive: true });
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(docsDir, 'swagger.json'), JSON.stringify(document, null, 2));
    return app;
}
async function bootstrap() {
    const app = await createApp();
    await app.listen(3000);
}
if (require.main === module) {
    void bootstrap();
}
//# sourceMappingURL=main.js.map