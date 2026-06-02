// src/invitations/invitations.controller.ts
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
} from '@nestjs/common';
import { Response } from 'express';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class InvitationsController {
  constructor(
    private invitationsService: InvitationsService,
    private prisma: PrismaService,
  ) {}

  @UseGuards(JwtGuard)
  @Post('workspaces/:id/invitations')
  invite(
    @Request() req,
    @Param('id') workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.invite(req.user.id, workspaceId, dto);
  }

  @UseGuards(JwtGuard)
  @Get('invitations/preview')
  preview(@Query('token') token: string) {
    return this.invitationsService.preview(token);
  }

  @UseGuards(JwtGuard)
  @Get('invitations/accept')
  accept(@Query('token') token: string, @Request() req) {
    return this.invitationsService.accept(token, req.user.id);
  }

  @UseGuards(JwtGuard)
  @Delete('invitations/decline')
  decline(@Query('token') token: string, @Request() req) {
    return this.invitationsService.decline(token, req.user.id);
  }

  /**
   * TEST-ONLY — returns the latest pending invitation token for a given email.
   * DISABLED in production (returns 404).
   */
  @Get('test/invitations/token')
  async testGetToken(
    @Query('email') email: string,
    @Res() res: Response,
  ) {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const invitation = await this.prisma.invitation.findFirst({
      where: { email },
      orderBy: { expiration: 'desc' },
    });
    if (!invitation) {
      res.status(404).json({ message: 'No pending invitation.' });
      return;
    }
    res.json({ token: invitation.token });
  }
}