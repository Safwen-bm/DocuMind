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
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtGuard } from '../auth/jwt.guard';

@Controller()
export class InvitationsController {
  constructor(private invitationsService: InvitationsService) {}

  // Send invitation
  @UseGuards(JwtGuard)
  @Post('workspaces/:id/invitations')
  invite(
    @Request() req,
    @Param('id') workspaceId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.invite(req.user.id, workspaceId, dto);
  }

  // Preview: get workspace name + role before accepting (requires auth)
  @UseGuards(JwtGuard)
  @Get('invitations/preview')
  preview(@Query('token') token: string) {
    return this.invitationsService.preview(token);
  }

  // Accept
  @UseGuards(JwtGuard)
  @Get('invitations/accept')
  accept(@Query('token') token: string, @Request() req) {
    return this.invitationsService.accept(token, req.user.id);
  }

  // Decline
  @UseGuards(JwtGuard)
  @Delete('invitations/decline')
  decline(@Query('token') token: string, @Request() req) {
    return this.invitationsService.decline(token, req.user.id);
  }
}