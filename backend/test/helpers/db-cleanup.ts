// test/helpers/db-cleanup.ts
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Explicitly load the .env.test file so this Prisma client uses the SAME
// database as the NestJS app under test.  Without this, the raw PrismaClient()
// constructor picks up whatever DATABASE_URL is in the shell environment,
// which may differ from what NestJS resolves via its own config module.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
// Fall back to .env if .env.test doesn't exist
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      // Explicitly read from the environment so we're 100% sure which DB we hit
      url: process.env.DATABASE_URL,
    },
  },
});

/**
 * Nuclear cleanup — TRUNCATE with CASCADE bypasses all FK constraint ordering.
 * Fastest and most reliable approach for test isolation.
 * All tables are wiped in one shot; Postgres handles the dependency graph.
 */
export async function cleanDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      messages_ia,
      conversations,
      ai_usage,
      document_chunks,
      document_favoris,
      document_views,
      versions_document,
      share_tokens,
      commentaires,
      documents,
      dossiers,
      activites,
      notifications,
      invitations,
      membres_workspace,
      subscriptions,
      workspaces,
      tokens_verification,
      utilisateurs
    RESTART IDENTITY CASCADE
  `);
}

export { prisma };