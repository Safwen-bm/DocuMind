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
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  // Create document in a workspace
  @Post('workspaces/:workspaceId/documents')
  create(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(req.user.id, workspaceId, dto);
  }

  // List documents in a workspace (optional ?dossierId= filter)
  @Get('workspaces/:workspaceId/documents')
  findAll(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Query('dossierId') dossierId?: string,
  ) {
    return this.documentsService.findAll(req.user.id, workspaceId, dossierId);
  }

  // Dashboard: recent documents across all workspaces
  @Get('documents/recent')
  getRecent(@Request() req) {
    return this.documentsService.getRecentAcrossWorkspaces(req.user.id);
  }

  // Dashboard: favoris across all workspaces
  @Get('documents/favoris')
  getFavoris(@Request() req) {
    return this.documentsService.getFavoris(req.user.id);
  }

  // Dashboard: stats across all workspaces
  @Get('documents/stats')
  getStats(@Request() req) {
    return this.documentsService.getStats(req.user.id);
  }

  // Get one document
  @Get('documents/:id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.documentsService.findOne(req.user.id, id);
  }

  // Update document (content, title, favori)
  @Patch('documents/:id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(req.user.id, id, dto);
  }

  // Toggle favori
  @Patch('documents/:id/favori')
  toggleFavori(@Request() req, @Param('id') id: string) {
    return this.documentsService.update(req.user.id, id, {
      estFavori: undefined,
    });
  }

  // Delete document
  @Delete('documents/:id')
  remove(@Request() req, @Param('id') id: string) {
    return this.documentsService.remove(req.user.id, id);
  }

  // Get version history
  @Get('documents/:id/versions')
  getVersions(@Request() req, @Param('id') id: string) {
    return this.documentsService.getVersions(req.user.id, id);
  }

  // Restore a version
  @Post('documents/:id/restore/:versionId')
  restoreVersion(
    @Request() req,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.restoreVersion(req.user.id, id, versionId);
  }

  @Patch('documents/:id/silent')
  updateSilent(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.updateSilent(req.user.id, id, dto);
  }
}
