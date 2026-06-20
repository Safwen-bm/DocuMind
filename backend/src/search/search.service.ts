// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\search\search.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

export interface SearchResult {
  documentId: string;
  titre: string;
  excerpt: string;
  workspaceId: string;
  workspaceNom: string;
  dossierId: string | null;
  dossierNom: string | null;
  dateMiseAJour: string;
  matchType: 'fulltext' | 'semantic' | 'both';
  score: number;
}

// ── Weights for the hybrid score ──────────────────────────────────────────────
// BM25 and semantic scores are first normalized to [0..100] independently,
// then combined. Semantic is weighted higher because it handles synonyms and
// paraphrases that BM25 misses entirely.
const WEIGHT_FULLTEXT = 0.4;
const WEIGHT_SEMANTIC  = 0.6;
const BONUS_BOTH       = 15;   // extra points when a doc matches via both engines

// Lower threshold vs the original 0.70 — catches synonym matches like
// "assistant virtuel" → chatbot (typical cosine similarity ~0.62–0.68)
const SEMANTIC_THRESHOLD = 0.55;

// Max retries for Gemini 503 / rate-limit errors
const EMBEDDING_MAX_RETRIES = 2;
const EMBEDDING_RETRY_DELAY_MS = 600;

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async search(
    userId: string,
    workspaceId: string,
    query: string,
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) return [];

    const membre = await this.prisma.membreWorkspace.findUnique({
      where: { utilisateurId_workspaceId: { utilisateurId: userId, workspaceId } },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const q = query.trim();

    // ── 1. Full-text search (BM25 via PostgreSQL ts_rank) ─────────────────
    const fulltextRows = await this.prisma.$queryRaw<
      {
        id: string;
        titre: string;
        contenu: any;
        workspaceId: string;
        workspaceNom: string;
        dossierId: string | null;
        dossierNom: string | null;
        dateMiseAJour: Date;
        rank: number;
      }[]
    >`
      WITH doc_text AS (
        SELECT
          d.id,
          d.titre,
          d.contenu,
          d."workspaceId",
          d."dossierId",
          d."dateMiseAJour",
          w.nom  AS "workspaceNom",
          dos.nom AS "dossierNom",
          COALESCE(
            (
              WITH RECURSIVE nodes AS (
                SELECT jsonb_array_elements(
                  CASE
                    WHEN d.contenu IS NULL          THEN '[]'::jsonb
                    WHEN d.contenu->'content' IS NULL THEN '[]'::jsonb
                    ELSE d.contenu->'content'
                  END
                ) AS node
                UNION ALL
                SELECT jsonb_array_elements(
                  CASE
                    WHEN n.node->'content' IS NOT NULL THEN n.node->'content'
                    ELSE '[]'::jsonb
                  END
                )
                FROM nodes n
                WHERE n.node->'content' IS NOT NULL
              )
              SELECT string_agg(node->>'text', ' ')
              FROM nodes
              WHERE node->>'type' = 'text'
                AND node->>'text' IS NOT NULL
                AND trim(node->>'text') != ''
            ),
            ''
          ) AS extracted_text
        FROM documents d
        JOIN workspaces w ON w.id = d."workspaceId"
        LEFT JOIN dossiers dos ON dos.id = d."dossierId"
        WHERE d."workspaceId" = ${workspaceId}
          AND d."estArchive" = false
      )
      SELECT
        id,
        titre,
        contenu,
        "workspaceId",
        "workspaceNom",
        "dossierId",
        "dossierNom",
        "dateMiseAJour",
        ts_rank(
          to_tsvector('simple', titre || ' ' || extracted_text),
          plainto_tsquery('simple', ${q})
        ) AS rank
      FROM doc_text
      WHERE
        to_tsvector('simple', titre || ' ' || extracted_text)
        @@ plainto_tsquery('simple', ${q})
      ORDER BY rank DESC
      LIMIT 20
    `;

    // ── 2. Semantic search via pgvector ───────────────────────────────────
    let semanticRows: {
      documentId: string;
      titre: string;
      contenu: string;
      workspaceId: string;
      workspaceNom: string;
      dossierId: string | null;
      dossierNom: string | null;
      dateMiseAJour: Date;
      similarity: number;
    }[] = [];

    try {
      const embedding = await this.getEmbeddingWithRetry(q);

      if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        semanticRows = await this.prisma.$queryRaw`
          SELECT
            d.id            AS "documentId",
            d.titre,
            dc.contenu,
            d."workspaceId",
            w.nom           AS "workspaceNom",
            d."dossierId",
            dos.nom         AS "dossierNom",
            d."dateMiseAJour",
            1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
          FROM document_chunks dc
          JOIN documents d   ON d.id  = dc."documentId"
          JOIN workspaces w  ON w.id  = d."workspaceId"
          LEFT JOIN dossiers dos ON dos.id = d."dossierId"
          WHERE d."workspaceId" = ${workspaceId}
            AND d."estArchive"  = false
            AND 1 - (dc.embedding <=> ${vectorStr}::vector) > ${SEMANTIC_THRESHOLD}
          ORDER BY dc.embedding <=> ${vectorStr}::vector
          LIMIT 20
        `;
      } else {
        console.warn('[Search] Semantic skipped — embedding unavailable after retries');
      }
    } catch (err) {
      // Non-blocking: fall back to fulltext-only ranking
      console.error('[Search] Semantic search error:', err);
    }

    // ── 3. Normalize each engine's scores independently to [0..100] ───────
    //
    // BM25 ts_rank returns tiny floats (typically 0.0001..0.08).
    // Semantic cosine similarity is already [0..1] but varies in range.
    // Without normalization, addition is meaningless — one engine dominates.
    //
    const ftNormalized  = normalizeScores(fulltextRows.map(r => Number(r.rank)));
    const semNormalized = normalizeScores(semanticRows.map(r => Number(r.similarity)));

    // ── 4. Merge + deduplicate ────────────────────────────────────────────
    const merged = new Map<string, SearchResult>();

    fulltextRows.forEach((r, i) => {
      const excerpt = this.extractExcerpt(r.contenu, q);
      merged.set(r.id, {
        documentId:    r.id,
        titre:         r.titre,
        excerpt,
        workspaceId:   r.workspaceId,
        workspaceNom:  r.workspaceNom,
        dossierId:     r.dossierId,
        dossierNom:    r.dossierNom,
        dateMiseAJour: r.dateMiseAJour.toISOString(),
        matchType:     'fulltext',
        score:         ftNormalized[i] * WEIGHT_FULLTEXT,
      });
    });

    semanticRows.forEach((r, i) => {
      const semScore = semNormalized[i] * WEIGHT_SEMANTIC;

      if (merged.has(r.documentId)) {
        // Doc matched both engines — upgrade type and add bonus
        const existing = merged.get(r.documentId)!;
        existing.matchType = 'both';
        existing.score    += semScore + BONUS_BOTH;
        // Prefer the semantic excerpt if the existing one is thin
        if (!existing.excerpt || existing.excerpt.length < 80) {
          existing.excerpt = r.contenu.slice(0, 200) + '…';
        }
      } else {
        merged.set(r.documentId, {
          documentId:    r.documentId,
          titre:         r.titre,
          excerpt:       r.contenu.slice(0, 200) + '…',
          workspaceId:   r.workspaceId,
          workspaceNom:  r.workspaceNom,
          dossierId:     r.dossierId,
          dossierNom:    r.dossierNom,
          dateMiseAJour: r.dateMiseAJour.toISOString(),
          matchType:     'semantic',
          score:         semScore,
        });
      }
    });

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  // ── Embedding with retry ─────────────────────────────────────────────────
  // Gemini returns 503 under load. We retry with a short delay before giving
  // up and falling back to fulltext-only. This is the main fix for the 503 error.
  private async getEmbeddingWithRetry(text: string): Promise<number[] | null> {
    for (let attempt = 0; attempt <= EMBEDDING_MAX_RETRIES; attempt++) {
      try {
        const embedding = await this.aiService.getEmbeddingPublic(text);
        return embedding; // null means intentionally skipped (rate-limited)
      } catch (err: any) {
        const isTransient =
          err?.message?.includes('503') ||
          err?.message?.includes('UNAVAILABLE') ||
          err?.message?.includes('429') ||
          err?.message?.includes('rate');

        if (isTransient && attempt < EMBEDDING_MAX_RETRIES) {
          const delay = EMBEDDING_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(`[Search] Embedding attempt ${attempt + 1} failed (${err.message}), retrying in ${delay}ms…`);
          await sleep(delay);
        } else {
          // Non-transient error or out of retries — rethrow so the caller logs it
          throw err;
        }
      }
    }
    return null;
  }

  // ── Excerpt extraction ───────────────────────────────────────────────────
  private extractExcerpt(contenu: any, query: string): string {
    if (!contenu) return '';
    const text = this.extractText(contenu);
    if (!text?.trim()) return '';

    const lower      = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx        = lower.indexOf(queryLower);

    if (idx === -1) {
      return text.slice(0, 180) + (text.length > 180 ? '…' : '');
    }

    const start = Math.max(0, idx - 60);
    const end   = Math.min(text.length, idx + queryLower.length + 120);
    return (
      (start > 0 ? '…' : '') +
      text.slice(start, end) +
      (end < text.length ? '…' : '')
    );
  }

  private extractText(node: any): string {
    if (!node)                                    return '';
    if (typeof node === 'string')                 return node;
    if (node.type === 'text')                     return node.text || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content
        .map((child: any) => this.extractText(child))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    return '';
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Min-max normalize an array of raw scores to [0..100].
 * When all scores are identical (or there's only one), returns 100 for every
 * element so at least that result appears in the merged ranking.
 */
function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range === 0) return scores.map(() => 100);
  return scores.map(s => ((s - min) / range) * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}