// src/documents/export.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  ImageRun,
  AlignmentType,
  LevelFormat,
} from 'docx';
import * as https from 'https';
import * as http from 'http';

interface TipTapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TipTapNode {
  type: string;
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, any>;
  content?: TipTapNode[];
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  private async checkMember(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');
    return membre;
  }

  private async fetchDoc(userId: string, documentId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { workspace: { select: { id: true, nom: true } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable.');
    await this.checkMember(userId, doc.workspaceId);
    return doc;
  }

  // ── Fetch image → Buffer. Handles both remote URLs and base64 data URIs ──
  private async fetchImageBuffer(url: string): Promise<Buffer | null> {
    if (url.startsWith('data:')) {
      try {
        const base64 = url.split(',')[1];
        return base64 ? Buffer.from(base64, 'base64') : null;
      } catch {
        return null;
      }
    }
    return new Promise((resolve) => {
      try {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: 8000 }, (res) => {
          if (res.statusCode !== 200) {
            resolve(null);
            return;
          }
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', () => resolve(null));
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  private collectImageSrcs(nodes: TipTapNode[]): string[] {
    const srcs: string[] = [];
    for (const node of nodes) {
      if (node.type === 'image' && node.attrs?.src) srcs.push(node.attrs.src);
      if (node.content) srcs.push(...this.collectImageSrcs(node.content));
    }
    return [...new Set(srcs)];
  }

  private plainText(nodes: TipTapNode[]): string {
    return nodes.map((n) => n.text ?? '').join('');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PDF EXPORT — Puppeteer (headless Chrome)
  //
  //  Pipeline: TipTap JSON → HTML string with inline CSS → Puppeteer → PDF
  //
  //  Why Puppeteer:
  //    ✅ Colors preserved exactly (red text stays red)
  //    ✅ Images at full quality, correct position
  //    ✅ Real tables with styled borders and header shading
  //    ✅ Bold / italic / underline / strikethrough / highlight
  //    ✅ All fonts rendered by Chrome's engine
  //    ✅ Proper page breaks
  // ══════════════════════════════════════════════════════════════════════════

  async exportPdf(userId: string, documentId: string): Promise<Buffer> {
    const doc = await this.fetchDoc(userId, documentId);
    const nodes = (doc.contenu as TipTapNode | null)?.content ?? [];

    // Pre-fetch all images and inline them as base64 data URIs.
    // Puppeteer runs in a sandbox and cannot make external HTTP requests,
    // so we resolve all image URLs before handing off to the browser.
    const imageSrcs = this.collectImageSrcs(nodes);
    const imageMap = new Map<string, string>(); // original src → data URI

    await Promise.all(
      imageSrcs.map(async (src) => {
        if (src.startsWith('data:')) {
          imageMap.set(src, src);
          return;
        }
        const buf = await this.fetchImageBuffer(src);
        if (buf) {
          const ext =
            src.split('?')[0].split('.').pop()?.toLowerCase() ?? 'png';
          const mime =
            ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
          imageMap.set(src, `data:${mime};base64,${buf.toString('base64')}`);
        }
      }),
    );

    const html = this.buildHtml(nodes, imageMap, doc.titre);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true,
      });
      return Buffer.from(buffer);
    } finally {
      await browser.close();
    }
  }

  // ── Build a complete HTML page from TipTap nodes ──────────────────────────
  private buildHtml(
    nodes: TipTapNode[],
    imageMap: Map<string, string>,
    docTitle: string,
  ): string {
    const body =
      nodes.length > 0
        ? nodes.map((n) => this.nodeToHtml(n, imageMap)).join('\n')
        : '<p style="color:#9ca3af">(document vide)</p>';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${this.escHtml(docTitle)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.65;
    color: #1a1a2e;
  }
  h1 { font-size: 22pt; font-weight: 700; margin: 18pt 0 10pt; color: #1e3a5f; }
  h2 { font-size: 16pt; font-weight: 700; margin: 14pt 0 8pt;  color: #1e3a5f; }
  h3 { font-size: 13pt; font-weight: 700; margin: 10pt 0 6pt;  color: #1e3a5f; }
  p  { margin: 0 0 8pt; }
  p:empty::after { content: '\\00a0'; }
  ul, ol { margin: 6pt 0 6pt 22pt; padding: 0; }
  li { margin: 2pt 0; }
  blockquote {
    border-left: 4px solid #6366f1;
    padding: 6pt 14pt;
    margin: 10pt 0;
    color: #4b5563;
    background: #f8f8ff;
    border-radius: 0 4px 4px 0;
  }
  pre {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 10pt 12pt;
    margin: 8pt 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  code {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    background: #f3f4f6;
    padding: 1pt 4pt;
    border-radius: 3px;
  }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 14pt 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10pt 0;
    font-size: 11pt;
    page-break-inside: avoid;
  }
  th {
    background: #1e3a5f;
    color: #ffffff;
    font-weight: 700;
    padding: 7pt 10pt;
    border: 1px solid #c7d6e6;
    text-align: left;
  }
  td {
    padding: 6pt 10pt;
    border: 1px solid #d1d5db;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f7f9fc; }
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10pt auto;
    border-radius: 4px;
  }
  mark { padding: 0 2pt; border-radius: 2px; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }
</style>
</head>
<body>${body}</body>
</html>`;
  }

  // ── Single TipTap block node → HTML ──────────────────────────────────────
  private nodeToHtml(node: TipTapNode, imageMap: Map<string, string>): string {
    switch (node.type) {
      case 'paragraph': {
        const inner = this.inlineToHtml(node.content ?? []);
        return `<p>${inner || '&nbsp;'}</p>`;
      }

      case 'heading': {
        const lvl = Math.min(Math.max(node.attrs?.level ?? 1, 1), 6);
        return `<h${lvl}>${this.inlineToHtml(node.content ?? [])}</h${lvl}>`;
      }

      case 'bulletList': {
        const items = (node.content ?? [])
          .map((li) => `<li>${this.listItemHtml(li, imageMap)}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }

      case 'orderedList': {
        const items = (node.content ?? [])
          .map((li) => `<li>${this.listItemHtml(li, imageMap)}</li>`)
          .join('');
        return `<ol>${items}</ol>`;
      }

      case 'blockquote':
        return `<blockquote>${(node.content ?? []).map((n) => this.nodeToHtml(n, imageMap)).join('')}</blockquote>`;

      case 'codeBlock':
        return `<pre>${this.escHtml(this.plainText(node.content ?? []))}</pre>`;

      case 'horizontalRule':
        return `<hr>`;

      case 'image': {
        const src = node.attrs?.src ?? '';
        const resolved = imageMap.get(src) ?? src;
        if (!resolved) return '';
        return `<img src="${resolved}" alt="${this.escHtml(node.attrs?.alt ?? '')}">`;
      }

      case 'table': {
        const rows = (node.content ?? [])
          .map((row, rowIdx) => {
            const isHeader =
              rowIdx === 0 &&
              row.content?.every((c) => c.type === 'tableHeader');
            const cells = (row.content ?? [])
              .map((cell) => {
                const cellHtml = this.inlineToHtml(
                  cell.content?.[0]?.content ?? [],
                );
                return isHeader
                  ? `<th>${cellHtml}</th>`
                  : `<td>${cellHtml}</td>`;
              })
              .join('');
            return `<tr>${cells}</tr>`;
          })
          .join('');
        return `<table>${rows}</table>`;
      }

      default:
        return '';
    }
  }

  private listItemHtml(li: TipTapNode, imageMap: Map<string, string>): string {
    return (li.content ?? [])
      .map((n) =>
        n.type === 'paragraph'
          ? this.inlineToHtml(n.content ?? [])
          : this.nodeToHtml(n, imageMap),
      )
      .join('');
  }

  // ── Inline nodes (text + marks) → HTML with full styling ─────────────────
  private inlineToHtml(nodes: TipTapNode[]): string {
    return nodes
      .map((node) => {
        if (node.type === 'hardBreak') return '<br>';
        if (node.type !== 'text') return '';

        let html = this.escHtml(node.text ?? '');

        for (const mark of node.marks ?? []) {
          switch (mark.type) {
            case 'bold':
              html = `<strong>${html}</strong>`;
              break;
            case 'italic':
              html = `<em>${html}</em>`;
              break;
            case 'underline':
              html = `<u>${html}</u>`;
              break;
            case 'strike':
              html = `<s>${html}</s>`;
              break;
            case 'code':
              html = `<code>${html}</code>`;
              break;
            case 'link':
              html = `<a href="${this.escHtml(mark.attrs?.href ?? '#')}">${html}</a>`;
              break;
            case 'textStyle': {
              const styles: string[] = [];
              if (mark.attrs?.color) styles.push(`color:${mark.attrs.color}`);
              if (mark.attrs?.backgroundColor)
                styles.push(`background:${mark.attrs.backgroundColor}`);
              if (mark.attrs?.fontSize)
                styles.push(`font-size:${mark.attrs.fontSize}`);
              if (styles.length)
                html = `<span style="${styles.join(';')}">${html}</span>`;
              break;
            }
            case 'highlight': {
              const bg = mark.attrs?.color ?? '#fef08a';
              html = `<mark style="background:${bg}">${html}</mark>`;
              break;
            }
          }
        }

        return html;
      })
      .join('');
  }

  private escHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DOCX EXPORT — docx package
  //  ✅ Colors (textStyle mark → TextRun color)
  //  ✅ Bold / italic / underline / strikethrough
  //  ✅ Tables with real borders + header shading
  //  ✅ Images (Cloudinary URLs + base64 data URIs)
  //  ✅ Proper bullet / numbered lists
  // ══════════════════════════════════════════════════════════════════════════

  async exportDocx(userId: string, documentId: string): Promise<Buffer> {
    const doc = await this.fetchDoc(userId, documentId);
    const nodes = (doc.contenu as TipTapNode | null)?.content ?? [];

    const imageSrcs = this.collectImageSrcs(nodes);
    const imageBuffers = new Map<string, Buffer>();
    await Promise.all(
      imageSrcs.map(async (src) => {
        const buf = await this.fetchImageBuffer(src);
        if (buf) imageBuffers.set(src, buf);
      }),
    );

    const children = this.tiptapToDocxChildren(nodes, imageBuffers);

    const docxDoc = new DocxDocument({
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '•',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
          {
            reference: 'numbers',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      },
      sections: [{ properties: {}, children }],
    });

    return Packer.toBuffer(docxDoc);
  }

  private tiptapToDocxChildren(
    nodes: TipTapNode[],
    imageBuffers = new Map<string, Buffer>(),
  ): any[] {
    const children: any[] = [];

    if (nodes.length === 0) {
      children.push(new Paragraph({ children: [new TextRun('')] }));
      return children;
    }

    for (const node of nodes) {
      switch (node.type) {
        case 'heading': {
          const lvlMap: Record<
            number,
            (typeof HeadingLevel)[keyof typeof HeadingLevel]
          > = {
            1: HeadingLevel.HEADING_1,
            2: HeadingLevel.HEADING_2,
            3: HeadingLevel.HEADING_3,
          };
          children.push(
            new Paragraph({
              children: this.toDocxRuns(node.content ?? []),
              heading: lvlMap[node.attrs?.level ?? 1] ?? HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            }),
          );
          break;
        }

        case 'paragraph':
          children.push(
            new Paragraph({
              children: this.toDocxRuns(node.content ?? []),
              spacing: { after: 160 },
            }),
          );
          break;

        case 'blockquote':
          for (const child of node.content ?? []) {
            children.push(
              new Paragraph({
                children: this.toDocxRuns(child.content ?? []),
                indent: { left: 720 },
                spacing: { after: 160 },
                border: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.THICK, size: 6, color: '6366f1' },
                },
              }),
            );
          }
          break;

        case 'bulletList':
          for (const li of node.content ?? []) {
            children.push(
              new Paragraph({
                numbering: { reference: 'bullets', level: 0 },
                children: this.toDocxRuns(li.content?.[0]?.content ?? []),
                spacing: { after: 80 },
              }),
            );
          }
          break;

        case 'orderedList':
          for (const li of node.content ?? []) {
            children.push(
              new Paragraph({
                numbering: { reference: 'numbers', level: 0 },
                children: this.toDocxRuns(li.content?.[0]?.content ?? []),
                spacing: { after: 80 },
              }),
            );
          }
          break;

        case 'codeBlock':
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: this.plainText(node.content ?? []),
                  font: 'Courier New',
                  size: 20,
                }),
              ],
              shading: { fill: 'f3f4f6', type: ShadingType.CLEAR },
              spacing: { after: 160 },
            }),
          );
          break;

        case 'horizontalRule':
          children.push(
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: 'e5e7eb' },
              },
              spacing: { after: 160 },
            }),
          );
          break;

        case 'image': {
          const src = node.attrs?.src;
          const buf = src ? imageBuffers.get(src) : undefined;
          if (buf) {
            try {
              let imgType: 'jpg' | 'png' | 'gif' | 'bmp' = 'png';
              if (
                src.startsWith('data:image/jpeg') ||
                src.startsWith('data:image/jpg')
              )
                imgType = 'jpg';
              else if (src.startsWith('data:image/gif')) imgType = 'gif';
              else if (src.startsWith('data:image/bmp')) imgType = 'bmp';
              else if (!src.startsWith('data:')) {
                const ext =
                  src.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
                const m: Record<string, 'jpg' | 'png' | 'gif' | 'bmp'> = {
                  jpg: 'jpg',
                  jpeg: 'jpg',
                  png: 'png',
                  gif: 'gif',
                  bmp: 'bmp',
                };
                imgType = m[ext] ?? 'png';
              }
              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: buf,
                      transformation: { width: 500, height: 350 },
                      type: imgType,
                    }),
                  ],
                  spacing: { after: 160 },
                }),
              );
            } catch {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '[Image]',
                      italics: true,
                      color: '6b7280',
                    }),
                  ],
                }),
              );
            }
          } else if (src) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: '[Image]',
                    italics: true,
                    color: '6b7280',
                  }),
                ],
              }),
            );
          }
          break;
        }

        case 'table': {
          const borderDef = {
            style: BorderStyle.SINGLE,
            size: 1,
            color: 'D1D5DB',
          };
          const allBorders = {
            top: borderDef,
            bottom: borderDef,
            left: borderDef,
            right: borderDef,
          };

          const tableRows = (node.content ?? []).map((rowNode, rowIdx) => {
            const isHeader =
              rowIdx === 0 &&
              rowNode.content?.every((c) => c.type === 'tableHeader');

            return new TableRow({
              tableHeader: !!isHeader,
              children: (rowNode.content ?? []).map(
                (cellNode) =>
                  new TableCell({
                    borders: allBorders,
                    shading: isHeader
                      ? { fill: '1E3A5F', type: ShadingType.CLEAR }
                      : undefined,
                    margins: { top: 80, bottom: 80, left: 120, right: 120 },
                    children: [
                      new Paragraph({
                        children: this.toDocxRuns(
                          cellNode.content?.[0]?.content ?? [],
                          isHeader,
                        ),
                      }),
                    ],
                  }),
              ),
            });
          });

          if (tableRows.length > 0) {
            children.push(
              new Table({
                width: { size: 9026, type: WidthType.DXA },
                rows: tableRows,
              }),
            );
            children.push(new Paragraph({ spacing: { after: 160 } }));
          }
          break;
        }
      }
    }

    return children;
  }

  // ── TipTap inline nodes → docx TextRun[] with full color + marks support ─
  private toDocxRuns(nodes: TipTapNode[], forceWhite = false): TextRun[] {
    if (!nodes.length) return [new TextRun('')];

    return nodes.map((node) => {
      if (node.type !== 'text') return new TextRun('');
      const opts: any = { text: node.text ?? '' };

      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case 'bold':
            opts.bold = true;
            break;
          case 'italic':
            opts.italics = true;
            break;
          case 'underline':
            opts.underline = {};
            break;
          case 'strike':
            opts.strike = true;
            break;
          case 'code':
            opts.font = 'Courier New';
            opts.size = 20;
            break;
          case 'textStyle':
            if (mark.attrs?.color && !forceWhite) {
              opts.color = mark.attrs.color.replace(/^#/, '');
            }
            break;
          // highlight: docx doesn't support arbitrary bg colors on runs,
          // best we can do is bold the text to indicate it was highlighted
          case 'highlight':
            if (!forceWhite) opts.bold = true;
            break;
        }
      }

      if (forceWhite) opts.color = 'FFFFFF';
      return new TextRun(opts);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXCEL EXPORT — exceljs
  //  Each TipTap table node → one Excel sheet.
  //  If no tables exist → text content in one sheet.
  // ══════════════════════════════════════════════════════════════════════════

  async exportExcel(userId: string, documentId: string): Promise<Buffer> {
    const doc = await this.fetchDoc(userId, documentId);
    const nodes = (doc.contenu as TipTapNode | null)?.content ?? [];

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DocuMind';
    workbook.created = new Date();

    const tables = nodes.filter((n) => n.type === 'table');

    if (tables.length === 0) {
      // No tables — dump all text into a single sheet
      const sheet = workbook.addWorksheet(doc.titre.slice(0, 31) || 'Document');
      let row = 1;
      for (const node of nodes) {
        const text = this.plainText(node.content ?? []);
        if (!text.trim()) continue;
        const xlCell = sheet.getCell(row, 1);
        xlCell.value = text;
        if (node.type === 'heading') {
          xlCell.font = { bold: true, size: node.attrs?.level === 1 ? 14 : 12 };
        } else {
          xlCell.font = { size: 11 };
        }
        row++;
      }
      sheet.getColumn(1).width = 80;
    } else {
      tables.forEach((table, idx) => {
        const sheetName = `Table ${idx + 1}`;
        const sheet = workbook.addWorksheet(sheetName);

        (table.content ?? []).forEach((row, rowIdx) => {
          const isHeader =
            rowIdx === 0 &&
            row.content?.every((c: TipTapNode) => c.type === 'tableHeader');

          (row.content ?? []).forEach((cell: TipTapNode, colIdx: number) => {
            // Extract text value
            const inlineNodes = cell.content?.[0]?.content ?? [];
            const text = this.plainText(inlineNodes);

            const xlCell = sheet.getCell(rowIdx + 1, colIdx + 1);
            xlCell.value = text;

            // Border on every cell
            xlCell.border = {
              top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
              right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            };

            if (isHeader) {
              xlCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E3A5F' },
              };
              xlCell.font = {
                bold: true,
                color: { argb: 'FFFFFFFF' },
                size: 11,
              };
              xlCell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true,
              };
            } else {
              // Alternate row background
              if (rowIdx % 2 === 0) {
                xlCell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF7F9FC' },
                };
              }
              xlCell.alignment = { vertical: 'top', wrapText: true };

              // Respect inline text color from TipTap textStyle marks
              const colorMark = inlineNodes[0]?.marks?.find(
                (m: TipTapMark) => m.type === 'textStyle' && m.attrs?.color,
              );
              xlCell.font = {
                size: 11,
                bold:
                  inlineNodes[0]?.marks?.some(
                    (m: TipTapMark) => m.type === 'bold',
                  ) ?? false,
                italic:
                  inlineNodes[0]?.marks?.some(
                    (m: TipTapMark) => m.type === 'italic',
                  ) ?? false,
                ...(colorMark
                  ? {
                      color: {
                        argb: 'FF' + colorMark.attrs!.color.replace(/^#/, ''),
                      },
                    }
                  : {}),
              };
            }

            // Auto-width (minimum 18 chars, grow with content)
            const col = sheet.getColumn(colIdx + 1);
            const needed = Math.min(Math.max(text.length + 4, 18), 60);
            if (!col.width || col.width < needed) col.width = needed;
          });
        });

        // Freeze the header row
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
      });
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
