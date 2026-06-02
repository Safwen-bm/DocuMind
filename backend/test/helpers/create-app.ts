// test/helpers/create-app.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test env BEFORE any NestJS module is imported, so ConfigModule,
// PrismaService, etc. all see the right DATABASE_URL from the start.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); // fallback

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';

const cookieParser = require('cookie-parser');
const express = require('express');

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({
    rawBody: true,
    bodyParser: false,
  });

  app.use(cookieParser());
  app.use('/plans/webhook', express.raw({ type: '*/*' }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.init();
  return app;
}