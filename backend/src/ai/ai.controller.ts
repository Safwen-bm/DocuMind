import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtGuard } from '../auth/jwt.guard';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class ChatDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsOptional()
  @IsString()
  docId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

class GenerateDocDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  titre: string;

  @IsString()
  @IsNotEmpty()
  workspaceId: string;

  @IsOptional()
  @IsString()
  dossierId?: string;
}

@UseGuards(JwtGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  // ── RAG Chat ──────────────────────────────────────────────────────────
  @Post('chat')
  chat(@Request() req, @Body() dto: ChatDto) {
    return this.aiService.chat(
      req.user.id,
      dto.workspaceId,
      dto.question,
      dto.docId,
      dto.conversationId,
    );
  }

  // ── Summarize a document ──────────────────────────────────────────────
  @Post('summarize/:docId')
  summarize(@Request() req, @Param('docId') docId: string) {
    return this.aiService.summarize(req.user.id, docId);
  }

  // ── Simplify a document ──────────────────────────────────────────────
  // POST /ai/simplify/:docId
  @Post('simplify/:docId')
  simplify(@Request() req, @Param('docId') docId: string) {
    return this.aiService.simplify(req.user.id, docId);
  }

  // ── Generate a document from description ─────────────────────────────
  // POST /ai/generate
  @Post('generate')
  generate(@Request() req, @Body() dto: GenerateDocDto) {
    return this.aiService.generateDocument(
      req.user.id,
      dto.workspaceId,
      dto.description,
      dto.titre,
      dto.dossierId,
    );
  }

  // ── Reindex all docs in a workspace ──────────────────────────────────
  //  POST /ai/reindex/:workspaceId
  @Post('reindex/:workspaceId')
  reindex(@Request() req, @Param('workspaceId') workspaceId: string) {
    return this.aiService.reindexWorkspace(req.user.id, workspaceId);
  }

  // ── List conversations ────────────────────────────────────────────────
  //  GET /ai/conversations/:workspaceId?docId=xxx
  //  docId omitted  → all conversations for user in workspace
  //  docId=""       → workspace-wide conversations only
  //  docId="uuid"   → conversations scoped to that document
  @Get('conversations/:workspaceId')
  getConversations(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Query('docId') docId?: string,
  ) {
    return this.aiService.getConversations(req.user.id, workspaceId, docId);
  }

  // ── Get messages for a conversation ──────────────────────────────────
  //  GET /ai/conversations/:workspaceId/:conversationId/messages
  @Get('conversations/:workspaceId/:conversationId/messages')
  getMessages(@Request() req, @Param('conversationId') conversationId: string) {
    return this.aiService.getConversationMessages(req.user.id, conversationId);
  }

  // ── Delete a conversation (cascades messages) ─────────────────────────
  //  DELETE /ai/conversations/:conversationId
  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  deleteConversation(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ) {
    return this.aiService.deleteConversation(req.user.id, conversationId);
  }
}
