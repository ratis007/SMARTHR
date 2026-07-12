import * as path from 'path';
import * as dotenv from 'dotenv';
// Charger .env depuis le dossier du projet
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: false,
    exceptionFactory: (errors) => {
      const messages = errors.map(e => Object.values(e.constraints || {}).join(', ')).join('; ');
      return new (require('@nestjs/common').BadRequestException)(messages);
    },
  }));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('SmartHR API')
    .setDescription('Application RH & Payroll - API REST')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`SmartHR Backend running on http://0.0.0.0:${port}/api`);
  console.log(`Swagger docs: http://0.0.0.0:${port}/api/docs`);
}
bootstrap().catch((error) => {
  console.error('bootstrap failed', error);
  process.exit(1);
});
