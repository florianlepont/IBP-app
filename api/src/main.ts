import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');
  app.enableCors();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  // Keep startup log explicit for first local setup checks.
  console.log(`IBP API listening on http://localhost:${port}/v1/health`);
}

bootstrap().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
