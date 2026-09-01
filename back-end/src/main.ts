import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import express = require('express');
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export async function createApp() {
  const app = await NestFactory.create(AppModule);

  // ─── Security Middleware ────────────────────────────────────────────────
  // helmet: sets Content-Security-Policy, X-Frame-Options, X-XSS-Protection,
  //         Strict-Transport-Security, X-Content-Type-Options, etc.
  app.use(
    helmet({
      contentSecurityPolicy: false, // allow inline scripts on served static HTML pages
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow front-end static assets
    }),
  );

  // Request body size limits — prevent oversized payload DoS attacks.
  // 10 MB allows the /api/db sync snapshot (~160 KB typical) with ample headroom.
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Favicon route ──────────────────────────────────────────────────────
  app.use('/favicon.ico', (_req: express.Request, res: express.Response) => res.status(204).end());

  // ─── Static Files ────────────────────────────────────────────────────────
  app.use('/front-end', express.static(join(process.cwd(), '..', 'front-end')));

  // ─── Global Prefix & CORS ───────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableCors();

  // ─── Global Exception Filter — writes all errors to log files ───────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global Validation Pipe ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Rorizon Review-4 API')
    .setDescription('NestJS in-memory backend with RBAC role headers for Rorizon workflows.')
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-role',
        in: 'header',
        description: 'Role for RBAC authorization. Allowed values: Super User, COO, Manager, Analyst.',
      },
      'role',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  const docsDir = join(process.cwd(), 'docs');
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, 'swagger.json'), JSON.stringify(document, null, 2));
  return app;
}

async function bootstrap() {
  const app = await createApp();
  await app.listen(3000);
}

if (require.main === module) {
  void bootstrap();
}

