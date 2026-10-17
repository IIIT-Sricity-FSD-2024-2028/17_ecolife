import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);

  // Behind a reverse proxy/load balancer, tell Express how many proxy hops to trust so the
  // rate limiter sees each client's real IP instead of the proxy's. Set TRUST_PROXY=1 (hops) when deployed.
  const trustProxy = config.get<string>('TRUST_PROXY');
  if (trustProxy) {
    const value = /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy;
    app.getHttpAdapter().getInstance().set('trust proxy', value);
  }

  app.use(helmet());
  app.enableCors({
    origin: config.get('FRONTEND_ORIGIN') ?? 'http://localhost:5173',
    credentials: true,
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter(app.get(WINSTON_MODULE_NEST_PROVIDER) as any));
  app.useGlobalInterceptors(new ResponseInterceptor());

  // The API map is public information to anyone who can read it, so it is off in production unless ENABLE_SWAGGER=true.
  const swaggerEnabled = config.get('NODE_ENV') !== 'production' || config.get('ENABLE_SWAGGER') === 'true';
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tropos API')
      .setDescription(
        'Resource Usage & Impact Analytics Platform — REST API. Two portals share this ' +
          'backend: the org portal (/auth, org-scoped resources) and the admin portal ' +
          '(/admin-auth, platform-scoped resources).',
      )
      .setVersion('0.1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'org-jwt')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'admin-jwt')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Tropos API running on http://localhost:${port}`);
  if (swaggerEnabled) console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
