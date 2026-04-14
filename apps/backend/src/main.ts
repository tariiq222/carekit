import { NestFactory, Reflector } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap(): Promise<void> {
  // rawBody: true preserves the untouched request body buffer on req.rawBody,
  // required by webhook handlers (Moyasar, etc.) for HMAC signature verification.
  // Without this the body is JSON-parsed before the handler sees it and the
  // signature computed over the raw bytes would never match.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:5103'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
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
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = Number(process.env.PORT ?? 5100);
  await app.listen(port);
  Logger.log(`CareKit Backend v2 listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
