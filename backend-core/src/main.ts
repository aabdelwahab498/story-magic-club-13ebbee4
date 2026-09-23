import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { StructuredLogger } from './common/logging/structured-logger.js';
import type { Env } from './config/env.config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(new StructuredLogger());

  const configService = app.get<ConfigService<Env, true>>(ConfigService);

  // ── Security ─────────────────────────────────────────────────────────────
  // Fail-closed CORS: only origins explicitly listed in CORS_ALLOWED_ORIGINS
  // are permitted. The env var is required (validated at bootstrap), so the
  // server refuses to start without an explicit allow-list. No hardcoded
  // production domains.
  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    credentials: true,
  });

  app.use(helmet());
  app.use(cookieParser());

  // ── Routing ──────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '2',
  });

  // ── Validation ───────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Error handling ───────────────────────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── OpenAPI / Swagger Documentation ──────────────────────────────────────
  const isProduction = configService.get('NODE_ENV') === 'production';
  const enableSwagger =
    process.env.ENABLE_SWAGGER === 'true' ||
    (process.env.ENABLE_SWAGGER === undefined && !isProduction);

  if (enableSwagger) {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Najmah Backend Core API')
      .setDescription('Production API contract for Najmah AI Story Platform')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Graceful Shutdown ────────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Diagnostics & Start ──────────────────────────────────────────────────
  await app.init();
  const { runStartupDiagnostics } = await import('./common/diagnostics/startup-diagnostics.js');
  await runStartupDiagnostics(app);

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);
  logger.log(`Najmah Backend Core running on http://localhost:${port}/api/v2`);
}

void bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`Bootstrap failed: ${message}`);
  process.exit(1);
});
