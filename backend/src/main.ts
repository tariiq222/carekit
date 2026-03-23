import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security headers
  app.use(helmet());

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
  const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',') ?? [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger — disabled in production
  const isProduction = process.env['NODE_ENV'] === 'production';
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

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap();
