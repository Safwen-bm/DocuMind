// src/documents/documents.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { ExportService } from './export.service';
import { UploadService } from './upload.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { IsOptional, IsString } from 'class-validator';

class MoveDocumentDto {
  @IsOptional()
  @IsString()
  dossierId: string | null;
}

@UseGuards(JwtGuard)
@Controller()
export class DocumentsController {
  constructor(
    private documentsService: DocumentsService,
    private exportService: ExportService,
    private uploadService: UploadService,
  ) {}

  @Post('workspaces/:workspaceId/documents')
  create(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(req.user.id, workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/documents')
  findAll(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Query('dossierId') dossierId?: string,
  ) {
    return this.documentsService.findAll(req.user.id, workspaceId, dossierId);
  }

  @Post('workspaces/:workspaceId/documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('dossierId') dossierId?: string,
  ) {
    return this.uploadService.uploadAndCreate(
      req.user.id,
      workspaceId,
      file,
      dossierId,
    );
  }

  @Get('documents/recent')
  getRecent(@Request() req) {
    return this.documentsService.getRecentAcrossWorkspaces(req.user.id);
  }

  @Get('documents/favoris')
  getFavoris(@Request() req) {
    return this.documentsService.getFavoris(req.user.id);
  }

  @Get('documents/stats')
  getStats(@Request() req) {
    return this.documentsService.getStats(req.user.id);
  }

  @Get('documents/:id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.documentsService.findOne(req.user.id, id);
  }

  @Patch('documents/:id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(req.user.id, id, dto);
  }

  @Patch('documents/:id/silent')
  updateSilent(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.updateSilent(req.user.id, id, dto);
  }

  @Patch('documents/:id/move')
  move(@Request() req, @Param('id') id: string, @Body() dto: MoveDocumentDto) {
    return this.documentsService.moveDocument(
      req.user.id,
      id,
      dto.dossierId ?? null,
    );
  }

  // ── NEW: Personal favori toggle ───────────────────────────────────────────
  @Post('documents/:id/favori')
  toggleFavori(@Request() req, @Param('id') id: string) {
    return this.documentsService.toggleFavori(req.user.id, id);
  }

  @Delete('documents/:id')
  remove(@Request() req, @Param('id') id: string) {
    return this.documentsService.remove(req.user.id, id);
  }

  @Get('documents/:id/versions')
  getVersions(@Request() req, @Param('id') id: string) {
    return this.documentsService.getVersions(req.user.id, id);
  }

  @Post('documents/:id/restore/:versionId')
  restoreVersion(
    @Request() req,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.restoreVersion(req.user.id, id, versionId);
  }

  @Get('documents/:id/export/pdf')
  async exportPdf(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportService.exportPdf(req.user.id, id);
    const doc = await this.documentsService.findOne(req.user.id, id);
    const filename = encodeURIComponent(doc.titre || 'document') + '.pdf';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).end(buffer);
  }

  @Get('documents/:id/export/docx')
  async exportDocx(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportService.exportDocx(req.user.id, id);
    const doc = await this.documentsService.findOne(req.user.id, id);
    const filename = encodeURIComponent(doc.titre || 'document') + '.docx';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).end(buffer);
  }

  @Get('documents/:id/export/excel')
  async exportExcel(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const buffer = await this.exportService.exportExcel(req.user.id, id);
    const doc = await this.documentsService.findOne(req.user.id, id);
    const filename = encodeURIComponent(doc.titre || 'document') + '.xlsx';
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).end(buffer);
  }
}