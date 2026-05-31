// src/documents/upload.service.ts

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActiviteService } from '../activite/activite.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AiService } from '../ai/ai.service';
import { ActionType, Role } from '@prisma/client';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL_ID = 'gemini-3.1-flash-lite-preview';

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private activite: ActiviteService,
    private aiService: AiService,
    private notifications: NotificationsService,
  ) {}

  // ── Auth ───────────────────────────────────────────────────────────────────

  private async checkRole(userId: string, workspaceId: string) {
    const membre = await this.prisma.membreWorkspace.findUnique({
      where: {
        utilisateurId_workspaceId: { utilisateurId: userId, workspaceId },
      },
    });
    if (!membre) throw new ForbiddenException('Accès refusé.');
    const canEdit: Role[] = [
      Role.EDITEUR,
      Role.ADMINISTRATEUR,
      Role.PROPRIETAIRE,
    ];
    if (!canEdit.includes(membre.role))
      throw new ForbiddenException('Permission insuffisante.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ══════════════════════════════════════════════════════════════════════════

  async uploadAndCreate(
    userId: string,
    workspaceId: string,
    file: Express.Multer.File,
    dossierId?: string,
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Aucun fichier reçu ou fichier vide.');
    }

    await this.checkRole(userId, workspaceId);

    const name = file.originalname.toLowerCase();
    const mime = file.mimetype.toLowerCase().trim();
    const titre =
      file.originalname.replace(/\.[^/.]+$/, '').trim() || 'Document importé';
    const buf: Buffer = Buffer.isBuffer(file.buffer)
      ? file.buffer
      : Buffer.from(file.buffer);

    let contenu: any;

    // ── Route to the right parser based on mime/extension ─────────────────
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      contenu = await this.parsePdf(buf);
    } else if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword' ||
      name.endsWith('.docx') ||
      name.endsWith('.doc')
    ) {
      contenu = await this.parseDocx(buf);
    } else if (
      mime ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.ms-excel' ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls')
    ) {
      contenu = await this.parseExcel(buf);
    } else if (
      // ── NEW: Image types handled by Gemini Vision ─────────────────────────
      mime.startsWith('image/') ||
      name.endsWith('.png') ||
      name.endsWith('.jpg') ||
      name.endsWith('.jpeg') ||
      name.endsWith('.webp') ||
      name.endsWith('.gif')
    ) {
      contenu = await this.parseImage(buf, mime, titre);
    } else {
      throw new BadRequestException(
        `Format non supporté: "${file.mimetype}". Utilisez PDF, Word (.docx), Excel (.xlsx) ou une image (PNG, JPG, WEBP).`,
      );
    }

    const doc = await this.prisma.document.create({
      data: {
        titre,
        workspaceId,
        dossierId: dossierId || null,
        authorId: userId,
        contenu,
      },
      include: {
        author: { select: { id: true, nom: true, avatarUrl: true } },
        dossier: { select: { id: true, nom: true } },
      },
    });

    await this.activite.log({
      workspaceId,
      userId,
      action: ActionType.DOCUMENT_CREE,
      cible: doc.titre,
      cibleId: doc.id,
    });

    // Notify workspace members about the new document
    this.notifyNewDoc(userId, workspaceId, doc).catch(console.error);

    // Auto-index in background — fire and forget
    this.aiService.indexDocument(doc.id);

    return doc;
  }

  // ── Helper: notify members about new doc (fire and forget) ────────────────
  private async notifyNewDoc(userId: string, workspaceId: string, doc: any) {
    const membres = await this.prisma.membreWorkspace.findMany({
      where: { workspaceId },
      select: { utilisateurId: true },
    });
    await Promise.all(
      membres
        .filter((m) => m.utilisateurId !== userId)
        .map((m) =>
          this.notifications.create({
            userId: m.utilisateurId,
            type: 'NOUVEAU_DOCUMENT',
            message: `${doc.author.nom} a importé un nouveau document "${doc.titre}".`,
            workspaceId,
            lien: `/workspace/${workspaceId}/documents/${doc.id}`,
          }),
        ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  IMAGE → TipTap via Gemini Vision (gemini-3.1-flash-lite-preview)
  // ══════════════════════════════════════════════════════════════════════════

  private async parseImage(
    buf: Buffer,
    mimeType: string,
    titre: string,
  ): Promise<any> {
    const supportedMimes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
    ];
    const normalizedMime = supportedMimes.includes(mimeType)
      ? mimeType
      : 'image/jpeg';
    const base64Image = buf.toString('base64');

    const prompt = `You are an expert document analyzer. Analyze this image carefully and extract ALL visible content.

Convert the content into a well-structured document using TipTap JSON format.

STRICT OUTPUT RULES:
- Output ONLY valid JSON — no explanation, no markdown fences, no preamble
- Use the exact TipTap schema shown below
- Preserve the original language of any text you find
- If the image contains a table, reproduce it as a TipTap table
- If the image contains a list, reproduce it as bulletList or orderedList
- If the image contains headings or titles, use heading nodes (level 1, 2, or 3)
- If the image contains a diagram or illustration with no readable text, describe what you see in a paragraph
- If the image is a screenshot, describe the UI and extract any visible text
- Never invent content that is not visible in the image

TipTap JSON schema:
{
  "type": "doc",
  "content": [
    { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "Main Title" }] },
    { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Section" }] },
    { "type": "paragraph", "content": [{ "type": "text", "text": "Body text here." }] },
    { "type": "bulletList", "content": [
      { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Item" }] }] }
    ]},
    { "type": "orderedList", "content": [
      { "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Step" }] }] }
    ]},
    { "type": "table", "content": [
      { "type": "tableRow", "content": [
        { "type": "tableHeader", "attrs": {}, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Col" }] }] }
      ]},
      { "type": "tableRow", "content": [
        { "type": "tableCell", "attrs": {}, "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Value" }] }] }
      ]}
    ]}
  ]
}

Document title context: "${titre}"

Analyze the image and output only the JSON:`;

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new BadRequestException(
        'Clé API Gemini manquante. Configurez GEMINI_API_KEY dans votre .env.',
      );
    }

    let response: Response;
    try {
      response = await fetch(
        `${GEMINI_BASE}/models/${MODEL_ID}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: { mimeType: normalizedMime, data: base64Image },
                  },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
            },
          }),
        },
      );
    } catch (err: any) {
      throw new BadRequestException(
        `Impossible de contacter Gemini Vision: ${err.message}`,
      );
    }

    // ── Read body ONCE — store as text, then parse ─────────────────────────────
    const responseText = await response.text();

    if (!response.ok) {
      throw new BadRequestException(
        `Gemini Vision API error ${response.status}: ${responseText.slice(0, 300)}`,
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new BadRequestException('Gemini Vision returned invalid JSON.');
    }

    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!rawText.trim()) {
      return {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: titre }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: "L'image n'a pas pu être analysée automatiquement. Vous pouvez ajouter le contenu manuellement.",
              },
            ],
          },
        ],
      };
    }

    // Strip markdown fences Gemini sometimes adds
    const cleaned = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (parsed?.type === 'doc' && Array.isArray(parsed?.content)) {
        return parsed;
      }
      throw new Error('Not a TipTap doc');
    } catch {
      // Gemini returned readable text but not valid JSON — convert to TipTap
      return this.textToTiptap(cleaned);
    }
  }
  // ══════════════════════════════════════════════════════════════════════════
  //  PDF → TipTap  (pdfjs-dist)
  // ══════════════════════════════════════════════════════════════════════════

  private async parsePdf(buf: Buffer): Promise<any> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
    });

    let pdfDoc: any;
    try {
      pdfDoc = await loadingTask.promise;
    } catch (e: any) {
      throw new BadRequestException(`Impossible de lire le PDF: ${e.message}`);
    }

    const allNodes: any[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      let lastY: number | null = null;
      let lineText = '';
      const lines: string[] = [];

      for (const item of textContent.items as any[]) {
        const str: string = item.str ?? '';
        const y: number = item.transform?.[5] ?? 0;
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          if (lineText.trim()) lines.push(lineText.trim());
          lineText = '';
        }
        lineText += str + ' ';
        lastY = y;
      }
      if (lineText.trim()) lines.push(lineText.trim());

      allNodes.push(...this.linesToTiptapNodes(lines));

      try {
        const operatorList = await page.getOperatorList();
        const { OPS } = pdfjsLib;
        for (let j = 0; j < operatorList.fnArray.length; j++) {
          if (
            operatorList.fnArray[j] === OPS.paintImageXObject ||
            operatorList.fnArray[j] === OPS.paintXObject
          ) {
            const imgName = operatorList.argsArray[j]?.[0];
            if (!imgName) continue;
            try {
              const imgObj = await page.objs.get(imgName);
              if (!imgObj?.data) continue;
              const { width, height, data: pixelData, kind } = imgObj;
              if (!width || !height || !pixelData) continue;
              const dataUri = this.pixelsToDataUri(
                pixelData,
                width,
                height,
                kind ?? 2,
              );
              if (dataUri) {
                allNodes.push({
                  type: 'image',
                  attrs: { src: dataUri, alt: null, title: null },
                });
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch {
        /* image extraction failed */
      }
    }

    return {
      type: 'doc',
      content:
        allNodes.length > 0 ? allNodes : [{ type: 'paragraph', content: [] }],
    };
  }

  private pixelsToDataUri(
    data: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    kind: number,
  ): string | null {
    try {
      let rgba: Uint8Array;
      if (kind === 3) {
        rgba = new Uint8Array(data.buffer);
      } else if (kind === 2) {
        rgba = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          rgba[i * 4] = data[i * 3];
          rgba[i * 4 + 1] = data[i * 3 + 1];
          rgba[i * 4 + 2] = data[i * 3 + 2];
          rgba[i * 4 + 3] = 255;
        }
      } else {
        rgba = new Uint8Array(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const v =
            kind === 1 ? (data[i >> 3] & (0x80 >> (i & 7)) ? 0 : 255) : data[i];
          rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = v;
          rgba[i * 4 + 3] = 255;
        }
      }
      const png = this.encodePng(rgba, width, height);
      return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    } catch {
      return null;
    }
  }

  private encodePng(
    rgba: Uint8Array,
    width: number,
    height: number,
  ): Uint8Array {
    const crc32 = (buf: Uint8Array): number => {
      let c = 0xffffffff;
      for (const b of buf) {
        c ^= b;
        for (let k = 0; k < 8; k++)
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      return (c ^ 0xffffffff) >>> 0;
    };
    const chunk = (type: string, data: Uint8Array): Uint8Array => {
      const tb = new TextEncoder().encode(type);
      const len = new Uint8Array(4);
      new DataView(len.buffer).setUint32(0, data.length, false);
      const cd = new Uint8Array(tb.length + data.length);
      cd.set(tb);
      cd.set(data, tb.length);
      const crc = new Uint8Array(4);
      new DataView(crc.buffer).setUint32(0, crc32(cd), false);
      const out = new Uint8Array(4 + 4 + data.length + 4);
      out.set(len);
      out.set(tb, 4);
      out.set(data, 8);
      out.set(crc, 8 + data.length);
      return out;
    };
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, width, false);
    dv.setUint32(4, height, false);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const rowSize = width * 3;
    const raw = new Uint8Array(height * (1 + rowSize));
    for (let y = 0; y < height; y++) {
      raw[y * (1 + rowSize)] = 0;
      for (let x = 0; x < width; x++) {
        const s = (y * width + x) * 4,
          d = y * (1 + rowSize) + 1 + x * 3;
        raw[d] = rgba[s];
        raw[d + 1] = rgba[s + 1];
        raw[d + 2] = rgba[s + 2];
      }
    }
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const parts = [
      sig,
      chunk('IHDR', ihdr),
      chunk('IDAT', this.zlibStore(raw)),
      chunk('IEND', new Uint8Array(0)),
    ];
    const total = parts.reduce((s, p) => s + p.length, 0);
    const png = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      png.set(p, off);
      off += p.length;
    }
    return png;
  }

  private zlibStore(data: Uint8Array): Uint8Array {
    const CHUNK = 65535,
      blocks = Math.ceil(data.length / CHUNK) || 1;
    const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
    let pos = 0;
    out[pos++] = 0x78;
    out[pos++] = 0x01;
    for (let i = 0; i < blocks; i++) {
      const start = i * CHUNK,
        end = Math.min(start + CHUNK, data.length);
      const bd = data.subarray(start, end);
      const isLast = i === blocks - 1 ? 1 : 0;
      out[pos++] = isLast;
      const len = bd.length;
      out[pos++] = len & 0xff;
      out[pos++] = (len >> 8) & 0xff;
      out[pos++] = ~len & 0xff;
      out[pos++] = (~len >> 8) & 0xff;
      out.set(bd, pos);
      pos += bd.length;
    }
    let s1 = 1,
      s2 = 0;
    for (const b of data) {
      s1 = (s1 + b) % 65521;
      s2 = (s2 + s1) % 65521;
    }
    const adler = (s2 << 16) | s1;
    out[pos++] = (adler >> 24) & 0xff;
    out[pos++] = (adler >> 16) & 0xff;
    out[pos++] = (adler >> 8) & 0xff;
    out[pos++] = adler & 0xff;
    return out.subarray(0, pos);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DOCX → TipTap
  // ══════════════════════════════════════════════════════════════════════════

  private async parseDocx(buf: Buffer): Promise<any> {
    const mammoth = require('mammoth');
    const imageHandler = (image: any) =>
      image.read('base64').then((b64: string) => ({
        src: `data:${image.contentType};base64,${b64}`,
      }));
    try {
      const result = await mammoth.convertToHtml(
        { buffer: buf },
        { convertImage: mammoth.images.imgElement(imageHandler) },
      );
      if (result?.value?.trim()) return this.htmlToTiptap(result.value);
    } catch {
      /* fall through */
    }
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      return this.textToTiptap(result?.value || '');
    } catch (e: any) {
      throw new BadRequestException(
        `Impossible de lire le fichier Word: ${e.message}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXCEL → TipTap
  // ══════════════════════════════════════════════════════════════════════════

  private async parseExcel(buf: Buffer): Promise<any> {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buf);
    } catch (e: any) {
      throw new BadRequestException(
        `Impossible de lire le fichier Excel: ${e.message}`,
      );
    }

    const allNodes: any[] = [];

    workbook.eachSheet((worksheet: any) => {
      const sheetName: string = worksheet.name || 'Feuille';
      allNodes.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: sheetName }],
      });

      const tableRows: any[] = [];
      let hasData = false;

      worksheet.eachRow(
        { includeEmpty: false },
        (row: any, rowNumber: number) => {
          const isHeader = rowNumber === 1;
          const cells: any[] = [];

          row.eachCell({ includeEmpty: true }, (cell: any) => {
            let value = '';
            if (cell.value !== null && cell.value !== undefined) {
              if (typeof cell.value === 'object' && cell.value?.richText) {
                value = cell.value.richText
                  .map((rt: any) => rt.text ?? '')
                  .join('');
              } else if (cell.value instanceof Date) {
                value = cell.value.toLocaleDateString();
              } else if (
                typeof cell.value === 'object' &&
                cell.value?.formula
              ) {
                value = String(cell.value.result ?? '');
              } else {
                value = String(cell.value);
              }
            }

            const marks: any[] = [];
            if (cell.font?.bold && !isHeader) marks.push({ type: 'bold' });
            if (cell.font?.italic) marks.push({ type: 'italic' });
            const argb: string | undefined = cell.font?.color?.argb;
            if (argb && argb !== 'FF000000' && argb.length === 8 && !isHeader) {
              marks.push({
                type: 'textStyle',
                attrs: { color: '#' + argb.slice(2) },
              });
            }

            const textNode: any = { type: 'text', text: value };
            if (marks.length > 0) textNode.marks = marks;

            cells.push({
              type: isHeader ? 'tableHeader' : 'tableCell',
              attrs: {},
              content: [{ type: 'paragraph', content: [textNode] }],
            });
          });

          if (cells.length > 0) {
            tableRows.push({ type: 'tableRow', content: cells });
            hasData = true;
          }
        },
      );

      if (hasData) {
        allNodes.push({ type: 'table', content: tableRows });
      } else {
        allNodes.push({
          type: 'paragraph',
          content: [{ type: 'text', text: `(${sheetName} est vide)` }],
        });
      }
      allNodes.push({ type: 'paragraph', content: [] });
    });

    return {
      type: 'doc',
      content:
        allNodes.length > 0 ? allNodes : [{ type: 'paragraph', content: [] }],
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  Helpers
  // ══════════════════════════════════════════════════════════════════════════

  private htmlToTiptap(html: string): any {
    const content: any[] = [];
    const normalized = html.replace(/<br\s*\/?>/gi, '\n');
    const blockRe =
      /<(h[1-6]|p|ul|ol|blockquote|img)([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/gi;
    let match: RegExpExecArray | null;

    while ((match = blockRe.exec(normalized)) !== null) {
      const tag = match[1].toLowerCase();
      const attrs = match[2];
      const inner = match[4] ?? '';

      if (tag === 'img') {
        const src = attrs.match(/src=["']([^"']+)["']/i)?.[1];
        if (src)
          content.push({
            type: 'image',
            attrs: { src, alt: null, title: null },
          });
        continue;
      }
      if (/^h[1-6]$/.test(tag)) {
        const level = Math.min(3, parseInt(tag[1]));
        const imgSrc = inner.match(/src=["']([^"']+)["']/i)?.[1];
        if (imgSrc)
          content.push({
            type: 'image',
            attrs: { src: imgSrc, alt: null, title: null },
          });
        const text = this.stripHtml(inner).trim();
        if (text)
          content.push({
            type: 'heading',
            attrs: { level },
            content: [{ type: 'text', text }],
          });
        continue;
      }
      if (tag === 'p') {
        const imgMatches = [...inner.matchAll(/src=["']([^"']+)["']/gi)];
        for (const im of imgMatches)
          content.push({
            type: 'image',
            attrs: { src: im[1], alt: null, title: null },
          });
        const text = this.stripHtml(inner).trim();
        if (text)
          content.push({
            type: 'paragraph',
            content: [{ type: 'text', text }],
          });
        else if (!imgMatches.length)
          content.push({ type: 'paragraph', content: [] });
        continue;
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
        if (items.length) {
          content.push({
            type: tag === 'ul' ? 'bulletList' : 'orderedList',
            content: items.map((m) => ({
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: this.stripHtml(m[1]).trim() },
                  ],
                },
              ],
            })),
          });
        }
        continue;
      }
      if (tag === 'blockquote') {
        const text = this.stripHtml(inner).trim();
        if (text)
          content.push({
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          });
        continue;
      }
    }

    return content.length > 0
      ? { type: 'doc', content }
      : this.textToTiptap(this.stripHtml(html));
  }

  private textToTiptap(rawText: string): any {
    const lines = rawText.split('\n');
    const content: any[] = [];

    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        const last = content[content.length - 1];
        if (!last || last.content?.length > 0)
          content.push({ type: 'paragraph', content: [] });
        continue;
      }
      if (
        t.length <= 80 &&
        t === t.toUpperCase() &&
        /[A-Z]/.test(t) &&
        !/[.!?,;:]$/.test(t)
      ) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: t }],
        });
        continue;
      }
      if (/^[•\-\*]\s+/.test(t)) {
        const text = t.replace(/^[•\-\*]\s+/, '');
        const last = content[content.length - 1];
        if (last?.type === 'bulletList') {
          last.content.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          });
        } else {
          content.push({
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text }] },
                ],
              },
            ],
          });
        }
        continue;
      }
      if (/^\d+[\.\)]\s+/.test(t)) {
        const text = t.replace(/^\d+[\.\)]\s+/, '');
        const last = content[content.length - 1];
        if (last?.type === 'orderedList') {
          last.content.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
          });
        } else {
          content.push({
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text }] },
                ],
              },
            ],
          });
        }
        continue;
      }
      content.push({ type: 'paragraph', content: [{ type: 'text', text: t }] });
    }

    while (content.length > 0) {
      const last = content[content.length - 1];
      if (last.type === 'paragraph' && !last.content?.length) content.pop();
      else break;
    }

    return {
      type: 'doc',
      content:
        content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
    };
  }

  private linesToTiptapNodes(lines: string[]): any[] {
    return (
      this.textToTiptap(lines.map((l) => this.sanitizeText(l)).join('\n'))
        .content ?? []
    );
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/ð·/g, '•')
      .replace(/ðŸ"·/g, '•')
      .replace(/\u00f0\u00b7/g, '•')
      .replace(/[\uFFFD]/g, '')
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFC]/g, (ch) => {
        const c = ch.charCodeAt(0);
        if (c >= 0x00c0 && c <= 0x024f) return ch;
        if (c >= 0x0600 && c <= 0x06ff) return ch;
        if (c >= 0x2000 && c <= 0x206f) return ch;
        if (c >= 0x2190 && c <= 0x21ff) return ch;
        if (c >= 0x2200 && c <= 0x22ff) return ch;
        return '';
      })
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<img[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#\d+;/g, '')
      .replace(/&[a-z]+;/g, '')
      .trim();
  }
}
