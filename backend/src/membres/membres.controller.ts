import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MembresService } from './membres.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('workspaces/:id/members')
export class MembresController {
  constructor(private membresService: MembresService) {}

  @Get()
  findAll(@Request() req, @Param('id') workspaceId: string) {
    return this.membresService.findAll(req.user.id, workspaceId);
  }

  @Patch(':userId')
  updateRole(
    @Request() req,
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membresService.updateRole(
      req.user.id,
      workspaceId,
      targetUserId,
      dto.role,
    );
  }

  @Delete(':userId')
  remove(
    @Request() req,
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.membresService.remove(req.user.id, workspaceId, targetUserId);
  }
}