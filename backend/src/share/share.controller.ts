// src/share/share.controller.ts

import {
  Controller, Post, Get, Delete,
  Param, Body, Request, UseGuards,
} from '@nestjs/common';
import { ShareService, SharePermission } from './share.service';
import { JwtGuard } from '../auth/jwt.guard';
import { IsString, IsIn, IsOptional, IsNumber, Min, Max } from 'class-validator';

class CreateShareDto {
  @IsIn(['READ', 'EDIT'])
  permission: SharePermission;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

@Controller()
export class ShareController {
  constructor(private shareService: ShareService) {}

  // ── Protected routes (require auth) ──────────────────────────────────

  @UseGuards(JwtGuard)
  @Post('documents/:id/share')
  createShareLink(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.shareService.createShareLink(
      req.user.id,
      id,
      dto.permission,
      dto.expiresInDays,
    );
  }

  @UseGuards(JwtGuard)
  @Get('documents/:id/share')
  getShareLinks(@Request() req, @Param('id') id: string) {
    return this.shareService.getShareLinks(req.user.id, id);
  }

  @UseGuards(JwtGuard)
  @Delete('share/tokens/:tokenId')
  revokeShareLink(@Request() req, @Param('tokenId') tokenId: string) {
    return this.shareService.revokeShareLink(req.user.id, tokenId);
  }

  // ── Public route — no auth needed ────────────────────────────────────

  @Get('share/:token')
  resolveToken(@Param('token') token: string) {
    return this.shareService.resolveToken(token);
  }
}