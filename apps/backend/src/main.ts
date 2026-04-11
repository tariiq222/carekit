import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 5100);
  await app.listen(port);
  Logger.log(`CareKit Backend v2 listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
