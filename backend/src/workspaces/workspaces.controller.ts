// C:\Users\MSI\Desktop\Projet\pfe-project\backend\src\workspaces\workspaces.controller.ts

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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { JwtGuard } from '../auth/jwt.guard';
import {
  WorkspaceRoleGuard,
  RequireRole,
} from '../auth/workspace-role.guard';
import { Role } from '@prisma/client';
import { ActiviteService } from '../activite/activite.service';

@UseGuards(JwtGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private workspacesService: WorkspacesService,
    private activiteService: ActiviteService,
  ) {}

  @Post()
  create(@Request() req, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.workspacesService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.workspacesService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.workspacesService.remove(req.user.id, id);
  }

  @Get(':id/analytics')
  getAnalytics(@Request() req, @Param('id') id: string) {
    return this.workspacesService.getAnalytics(req.user.id, id);
  }

  @Get(':id/activity')
  getActivity(@Request() req, @Param('id') id: string) {
    return this.workspacesService.getActivity(req.user.id, id);
  }

  // ── Admin Logs — ADMINISTRATEUR+ only ──────────────────────────────────────

  @Get(':id/admin-logs')
  @UseGuards(WorkspaceRoleGuard)
  @RequireRole(Role.ADMINISTRATEUR)
  getAdminLogs(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.activiteService.getAdminLogs(id, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      action: action as any,
      userId,
      search,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id/admin-logs/summary')
  @UseGuards(WorkspaceRoleGuard)
  @RequireRole(Role.ADMINISTRATEUR)
  getAdminLogsSummary(@Request() req, @Param('id') id: string) {
    return this.activiteService.getAdminLogsSummary(id);
  }

  // ── Members list for filter dropdown ───────────────────────────────────────
  @Get(':id/admin-logs/members')
  @UseGuards(WorkspaceRoleGuard)
  @RequireRole(Role.ADMINISTRATEUR)
  getAdminLogsMembersFilter(@Request() req, @Param('id') id: string) {
    return this.workspacesService.getMembersForFilter(req.user.id, id);
  }
}
