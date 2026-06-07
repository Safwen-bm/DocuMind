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

    // ── 1. Full-text search ───────────────────────────────────────────────
    const fulltextResults = await this.prisma.$queryRaw<
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
          d."estArchive",
          w.nom AS "workspaceNom",
          dos.nom AS "dossierNom",
          COALESCE(
            (
              WITH RECURSIVE nodes AS (
                SELECT jsonb_array_elements(
                  CASE
                    WHEN d.contenu IS NULL THEN '[]'::jsonb
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
    // Threshold 0.70 — only genuinely relevant content passes
    const SEMANTIC_THRESHOLD = 0.70;

    let semanticResults: {
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
      const embedding = await this.aiService.getEmbeddingPublic(q);

      // null means Gemini is rate-limited — skip semantic, fall back to fulltext only
      if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        semanticResults = await this.prisma.$queryRaw`
          SELECT
            d.id AS "documentId",
            d.titre,
            dc.contenu,
            d."workspaceId",
            w.nom AS "workspaceNom",
            d."dossierId",
            dos.nom AS "dossierNom",
            d."dateMiseAJour",
            1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
          FROM document_chunks dc
          JOIN documents d ON d.id = dc."documentId"
          JOIN workspaces w ON w.id = d."workspaceId"
          LEFT JOIN dossiers dos ON dos.id = d."dossierId"
          WHERE d."workspaceId" = ${workspaceId}
            AND d."estArchive" = false
            AND 1 - (dc.embedding <=> ${vectorStr}::vector) > ${SEMANTIC_THRESHOLD}
          ORDER BY dc.embedding <=> ${vectorStr}::vector
          LIMIT 20
        `;
      } else {
        console.warn('Semantic search skipped — Gemini embedding rate-limited');
      }
    } catch (err) {
      // Semantic failure is non-blocking — fall back to fulltext only
      console.error('Semantic search error:', err);
    }

    // ── 3. Merge + deduplicate + rank ─────────────────────────────────────
    const merged = new Map<string, SearchResult>();

    for (const r of fulltextResults) {
      const excerpt = this.extractExcerpt(r.contenu, q);
      merged.set(r.id, {
        documentId: r.id,
        titre: r.titre,
        excerpt,
        workspaceId: r.workspaceId,
        workspaceNom: r.workspaceNom,
        dossierId: r.dossierId,
        dossierNom: r.dossierNom,
        dateMiseAJour: r.dateMiseAJour.toISOString(),
        matchType: 'fulltext',
        score: Number(r.rank) * 100,
      });
    }

    for (const r of semanticResults) {
      const sim = Number(r.similarity);
      if (merged.has(r.documentId)) {
        const existing = merged.get(r.documentId)!;
        existing.matchType = 'both';
        existing.score += sim * 100;
        if (!existing.excerpt || existing.excerpt.length < 80) {
          existing.excerpt = r.contenu.slice(0, 200) + '...';
        }
      } else {
        merged.set(r.documentId, {
          documentId: r.documentId,
          titre: r.titre,
          excerpt: r.contenu.slice(0, 200) + '...',
          workspaceId: r.workspaceId,
          workspaceNom: r.workspaceNom,
          dossierId: r.dossierId,
          dossierNom: r.dossierNom,
          dateMiseAJour: r.dateMiseAJour.toISOString(),
          matchType: 'semantic',
          score: sim * 100,
        });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  private extractExcerpt(contenu: any, query: string): string {
    if (!contenu) return '';
    const text = this.extractText(contenu);
    if (!text || !text.trim()) return '';

    const lower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx = lower.indexOf(queryLower);

    if (idx === -1) {
      return text.slice(0, 180) + (text.length > 180 ? '...' : '');
    }

    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + queryLower.length + 120);
    return (
      (start > 0 ? '...' : '') +
      text.slice(start, end) +
      (end < text.length ? '...' : '')
    );
  }

  private extractText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.text || '';
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