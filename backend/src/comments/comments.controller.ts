// src/comments/comments.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('documents/:documentId/comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  // GET /documents/:documentId/comments
  @Get()
  findAll(@Request() req, @Param('documentId') documentId: string) {
    return this.commentsService.findAll(req.user.id, documentId);
  }

  // POST /documents/:documentId/comments
  @Post()
  create(
    @Request() req,
    @Param('documentId') documentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(req.user.id, documentId, dto);
  }

  // PATCH /documents/:documentId/comments/:commentId
  @Patch(':commentId')
  update(
    @Request() req,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.update(req.user.id, commentId, dto);
  }

  // PATCH /documents/:documentId/comments/:commentId/toggle-resolu
  @Patch(':commentId/toggle-resolu')
  toggleResolu(@Request() req, @Param('commentId') commentId: string) {
    return this.commentsService.toggleResolu(req.user.id, commentId);
  }

  // DELETE /documents/:documentId/comments/:commentId
  @Delete(':commentId')
  remove(@Request() req, @Param('commentId') commentId: string) {
    return this.commentsService.remove(req.user.id, commentId);
  }
}