// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\ai\ai.controller.ts

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
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { JwtGuard } from '../auth/jwt.guard';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsArray } from 'class-validator';

class ChatDto {
  @IsString() @IsNotEmpty() question: string;
  @IsString() @IsNotEmpty() workspaceId: string;
  @IsOptional() @IsString() docId?: string;
  @IsOptional() @IsString() conversationId?: string;
}

class ChatMultiDocDto {
  @IsString() @IsNotEmpty() question: string;
  @IsString() @IsNotEmpty() workspaceId: string;
  @IsArray() documentIds: string[];
  @IsOptional() @IsString() conversationId?: string;
}

class ChatWorkspaceDto {
  @IsString() @IsNotEmpty() question: string;
  @IsString() @IsNotEmpty() workspaceId: string;
  @IsOptional() @IsString() conversationId?: string;
}

class GenerateDocDto {
  @IsString() @IsNotEmpty() description: string;
  @IsString() @IsNotEmpty() titre: string;
  @IsString() @IsNotEmpty() workspaceId: string;
  @IsOptional() @IsString() dossierId?: string;
}

class InlineRewriteDto {
  @IsString() @IsNotEmpty() text: string;
  @IsString() @IsIn(['improve', 'simplify', 'rephrase', 'translate'])
  action: 'improve' | 'simplify' | 'rephrase' | 'translate';
}

class DocumentActionDto {
  @IsString() @IsIn(['decisions', 'tasks', 'keypoints', 'structure'])
  action: 'decisions' | 'tasks' | 'keypoints' | 'structure';
}

@UseGuards(JwtGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  // ── Standard RAG chat ─────────────────────────────────────────────────────
  @Post('chat')
  chat(@Request() req, @Body() dto: ChatDto) {
    return this.aiService.chat(req.user.id, dto.workspaceId, dto.question, dto.docId, dto.conversationId);
  }

  // ── Multi-doc RAG chat ────────────────────────────────────────────────────
  @Post('chat-multi')
  chatMultiDoc(@Request() req, @Body() dto: ChatMultiDocDto) {
    return this.aiService.chatMultiDoc(req.user.id, dto.workspaceId, dto.question, dto.documentIds, dto.conversationId);
  }

  // ── Workspace secretary chat ──────────────────────────────────────────────
  @Post('chat-workspace')
  chatWorkspace(@Request() req, @Body() dto: ChatWorkspaceDto) {
    return this.aiService.chatWorkspace(req.user.id, dto.workspaceId, dto.question, dto.conversationId);
  }

  // ── Summarize ─────────────────────────────────────────────────────────────
  @Post('summarize/:docId')
  summarize(@Request() req, @Param('docId') docId: string) {
    return this.aiService.summarize(req.user.id, docId);
  }

  // ── Simplify ──────────────────────────────────────────────────────────────
  @Post('simplify/:docId')
  simplify(@Request() req, @Param('docId') docId: string) {
    return this.aiService.simplify(req.user.id, docId);
  }

  // ── Inline rewrite ────────────────────────────────────────────────────────
  @Post('inline')
  async inlineRewrite(@Body() dto: InlineRewriteDto) {
    const result = await this.aiService.inlineRewrite(dto.text, dto.action);
    return { result };
  }

  // ── Document action buttons ───────────────────────────────────────────────
  @Post('actions/:docId')
  async documentActions(@Request() req, @Param('docId') docId: string, @Body() dto: DocumentActionDto) {
    const result = await this.aiService.documentActions(req.user.id, docId, dto.action);
    return { result };
  }

  // ── Generate document ─────────────────────────────────────────────────────
  @Post('generate')
  generate(@Request() req, @Body() dto: GenerateDocDto) {
    return this.aiService.generateDocument(req.user.id, dto.workspaceId, dto.description, dto.titre, dto.dossierId);
  }

  // ── Reindex workspace ─────────────────────────────────────────────────────
  @Post('reindex/:workspaceId')
  reindex(@Request() req, @Param('workspaceId') workspaceId: string) {
    return this.aiService.reindexWorkspace(req.user.id, workspaceId);
  }

  // ── List conversations ────────────────────────────────────────────────────
  @Get('conversations/:workspaceId')
  getConversations(@Request() req, @Param('workspaceId') workspaceId: string, @Query('docId') docId?: string) {
    return this.aiService.getConversations(req.user.id, workspaceId, docId);
  }

  // ── Get messages ──────────────────────────────────────────────────────────
  @Get('conversations/:workspaceId/:conversationId/messages')
  getMessages(@Request() req, @Param('conversationId') conversationId: string) {
    return this.aiService.getConversationMessages(req.user.id, conversationId);
  }

  // ── NEW: Export conversation as PDF ──────────────────────────────────────
  // GET /ai/conversations/:conversationId/export
  // Returns a PDF buffer with the full conversation (questions + answers + sources)
  @Get('conversations/:conversationId/export')
  async exportConversation(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.aiService.exportConversation(req.user.id, conversationId);
    const filename = encodeURIComponent(`conversation-${conversationId.slice(0, 8)}`) + '.pdf';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.status(HttpStatus.OK).end(buffer);
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.OK)
  deleteConversation(@Request() req, @Param('conversationId') conversationId: string) {
    return this.aiService.deleteConversation(req.user.id, conversationId);
  }
}