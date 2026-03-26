import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';
import { StructuredLogger } from './common/services/structured-logger.service.js';
import { initSentry } from './common/sentry/sentry.config.js';

// Sentry must init before NestFactory.create() to hook into Node.js internals
initSentry();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // rawBody must be enabled so Express captures the raw buffer before
    // the JSON body parser consumes the stream. Required for Moyasar
    // webhook HMAC-SHA256 signature verification.
    rawBody: true,
  });

  // Use the custom structured logger for all NestJS logging
  app.useLogger(app.get(StructuredLogger));

  // Security headers
  app.use(helmet());

  // Raw body capture for webhook signature verification.
  // Runs before cookieParser/CORS so the stream is untouched.
  // Only captures for the Moyasar webhook path to avoid buffering all requests.
  app.use(
    '/api/v1/payments/moyasar/webhook',
    (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        next();
      });
      req.on('error', next);
    },
  );

  // Cookie parser — must be before CORS
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // GlobalExceptionFilter and ResponseTransformInterceptor are registered
  // via APP_FILTER and APP_INTERCEPTOR in AppModule so they apply in both
  // production and e2e test contexts.

  // CORS — restrict to allowed origins
  const isProduction = process.env['NODE_ENV'] === 'production';
  const originsEnv = process.env['ALLOWED_ORIGINS'];
  if (isProduction && !originsEnv) {
    throw new Error('ALLOWED_ORIGINS must be set in production');
  }
  const allowedOrigins = originsEnv?.split(',').map((o) => o.trim()) ?? [
    'http://localhost:5001',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger — disabled in production
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('CareKit API')
      .setDescription('CareKit Clinic Management Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown — clean up connections on SIGTERM/SIGINT
  app.enableShutdownHooks();

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
