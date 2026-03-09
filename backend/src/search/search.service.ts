// src/search/search.service.ts

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

    // Verify membership
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');

    const q = query.trim();

    // ── 1. Full-text search via PostgreSQL ────────────────────────────────
    // We search in titre + text extracted from contenu JSON
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
      SELECT
        d.id,
        d.titre,
        d.contenu,
        d."workspaceId",
        w.nom AS "workspaceNom",
        d."dossierId",
        dos.nom AS "dossierNom",
        d."dateMiseAJour",
        ts_rank(
          to_tsvector('simple', d.titre || ' ' || COALESCE(d.contenu::text, '')),
          plainto_tsquery('simple', ${q})
        ) AS rank
      FROM documents d
      JOIN workspaces w ON w.id = d."workspaceId"
      LEFT JOIN dossiers dos ON dos.id = d."dossierId"
      WHERE d."workspaceId" = ${workspaceId}
        AND d."estArchive" = false
        AND to_tsvector('simple', d.titre || ' ' || COALESCE(d.contenu::text, ''))
            @@ plainto_tsquery('simple', ${q})
      ORDER BY rank DESC
      LIMIT 20
    `;

    // ── 2. Semantic search via pgvector ───────────────────────────────────
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
          AND 1 - (dc.embedding <=> ${vectorStr}::vector) > 0.3
        ORDER BY dc.embedding <=> ${vectorStr}::vector
        LIMIT 20
      `;
    } catch (err) {
      // Semantic search failure is non-blocking — fall back to fulltext only
      console.error('Semantic search error:', err);
    }

    // ── 3. Merge + deduplicate + rank ─────────────────────────────────────
    const merged = new Map<string, SearchResult>();

    // Add fulltext results
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

    // Merge semantic results — boost score if already found by fulltext
    for (const r of semanticResults) {
      const sim = Number(r.similarity);
      if (merged.has(r.documentId)) {
        const existing = merged.get(r.documentId)!;
        existing.matchType = 'both';
        existing.score += sim * 100;
        // Use semantic excerpt if it has more context
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

    // Sort by score descending, take top 15
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }

  // Extract a relevant excerpt from TipTap JSON around the query terms
  private extractExcerpt(contenu: any, query: string): string {
    if (!contenu) return '';
    const text = this.extractText(contenu);
    if (!text) return '';

    const lower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const idx = lower.indexOf(queryLower);

    if (idx === -1) {
      return text.slice(0, 180) + (text.length > 180 ? '...' : '');
    }

    const start = Math.max(0, idx - 60);
    const end = Math.min(text.length, idx + queryLower.length + 120);
    const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
    return excerpt;
  }

  private extractText(node: any): string {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) {
      return node.content.map((child: any) => this.extractText(child)).join(' ');
    }
    return '';
  }
}