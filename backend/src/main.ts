// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const cookieParser = require('cookie-parser');
const express = require('express');

async function bootstrap() {
  // ── Disable built-in body parser so we can control it per-route ──────────
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });

  app.use(cookieParser());

  // ── Stripe webhook: raw buffer — must be registered FIRST ────────────────
  app.use('/plans/webhook', express.raw({ type: '*/*' }));

  // ── Everything else: json + urlencoded ───────────────────────────────────
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('DocuMind API')
    .setDescription('API documentation for DocuMind platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();