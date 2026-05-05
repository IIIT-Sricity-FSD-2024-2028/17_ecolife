import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import express = require('express');
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(
    '/front-end',
    express.static(join(process.cwd(), '..', 'front-end'), {
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store');
      },
    }),
  );
  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

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
