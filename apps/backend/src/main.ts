// instrument.ts must be the first import — Sentry wraps OpenTelemetry before
// NestJS/Express load so all spans are captured from the start.
import './instrument';
import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { LoggingInterceptor, AuditInterceptor } from './common/interceptors';
import { PrismaService } from './infrastructure/database';
import { TenantContextService } from './common/tenant/tenant-context.service';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap(): Promise<void> {
  // rawBody: true preserves the untouched request body buffer on req.rawBody,
  // required by webhook handlers (Moyasar, etc.) for HMAC signature verification.
  // Without this the body is JSON-parsed before the handler sees it and the
  // signature computed over the raw bytes would never match.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());
  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:5103', 'http://localhost:5104', 'http://localhost:5105'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Org-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new AuditInterceptor(app.get(PrismaService), app.get(TenantContextService)));
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Deqah API')
    .setDescription('Deqah clinic management platform — dashboard & mobile API')
    .setVersion('2.0')
    .setContact('Deqah Engineering', 'https://deqah.dev', 'dev@deqah.dev')
    .setLicense('Proprietary', 'https://deqah.dev/license')
    .addBearerAuth()
    .addServer('http://localhost:5100', 'Local dev')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Expose the interactive UI only outside production — the OpenAPI JSON
  // snapshot (WRITE_OPENAPI_SPEC=1) is still generated in CI regardless.
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  if (process.env.WRITE_OPENAPI_SPEC === '1') {
    const outPath = resolve(__dirname, '../openapi.json');
    // Deterministic key order so git diffs stay readable: recursively sort
    // every object's keys before serializing. JSON.stringify's replacer
    // cannot do this (arrays act as a global property allowlist and drop
    // nested keys), so we walk the tree ourselves.
    const sortKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sortKeys);
      if (value && typeof value === 'object') {
        return Object.keys(value as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = sortKeys((value as Record<string, unknown>)[key]);
            return acc;
          }, {});
      }
      return value;
    };
    const ordered = JSON.stringify(sortKeys(document), null, 2);
    writeFileSync(outPath, ordered, 'utf-8');
    Logger.log(`OpenAPI spec written to ${outPath}`, 'Bootstrap');
    await app.close();
    return;
  }

  const port = Number(process.env.PORT ?? 5100);
  await app.listen(port);
  Logger.log(`Deqah Backend v2 listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
