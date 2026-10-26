import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`Fortex API em http://localhost:${port}`);
}

void bootstrap();
