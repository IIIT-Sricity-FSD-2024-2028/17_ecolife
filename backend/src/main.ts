import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { getEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Behind a load balancer set TRUST_PROXY=1 so rate limits see the real client IP.
  if (env.TRUST_PROXY > 0) (app as any).set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  // Small bodies everywhere; only the factor-release import (up to 500 rows) may be larger.
  app.use('/api/platform/factor-releases', json({ limit: '2mb' }));
  // The payment webhook is signed over the exact bytes received, so keep them.
  app.use('/api/billing/webhooks', json({ limit: '100kb', verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));
  app.enableCors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true
  });

  // Clean /api prefix (no /v1)
  app.setGlobalPrefix('api', { exclude: ['health', 'health/ready'] });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TimeoutInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tropos Carbon & Resource ERP API')
    .setDescription('NestJS + Prisma + PostgreSQL FORCE RLS + Local Bill OCR + Automated QA/QC Verification Engine')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(env.PORT);
  console.log(`Tropos NestJS API listening on http://localhost:${env.PORT}/api`);
  console.log(`Swagger OpenAPI Docs available at http://localhost:${env.PORT}/api/docs`);
}

bootstrap();
