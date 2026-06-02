// test/helpers/jest-setup.ts
// This file runs in every Jest worker before any test suite.
// It ensures DATABASE_URL and other env vars are set correctly
// before NestJS modules (ConfigModule, PrismaService) are initialised.

import * as dotenv from 'dotenv';
import * as path from 'path';

// Try .env.test first, then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });