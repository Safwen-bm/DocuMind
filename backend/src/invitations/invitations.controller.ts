import {
  Controller,
  Post,
  Get,
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
  @Get('invitations/accept')
  accept(@Query('token') token: string, @Request() req) {
    return this.invitationsService.accept(token, req.user.id);
  }
}