import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { DossiersService } from './dossiers.service';
import { CreateDossierDto } from './dto/create-dossier.dto';
import { UpdateDossierDto } from './dto/update-dossier.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { IsOptional, IsString } from 'class-validator';

class MoveDossierDto {
  @IsOptional()
  @IsString()
  parentId: string | null;
}

@UseGuards(JwtGuard)
@Controller('workspaces/:workspaceId/folders')
export class DossiersController {
  constructor(private dossiersService: DossiersService) {}

  @Post()
  create(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDossierDto,
  ) {
    return this.dossiersService.create(req.user.id, workspaceId, dto);
  }

  @Get()
  findAll(@Request() req, @Param('workspaceId') workspaceId: string) {
    return this.dossiersService.findAll(req.user.id, workspaceId);
  }

  @Get(':id/contents')
  getContents(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.dossiersService.getContents(req.user.id, workspaceId, id);
  }

  @Patch(':id')
  update(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDossierDto,
  ) {
    return this.dossiersService.update(req.user.id, workspaceId, id, dto);
  }

  @Patch(':id/move')
  move(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: MoveDossierDto,
  ) {
    return this.dossiersService.move(req.user.id, workspaceId, id, dto.parentId ?? null);
  }

  @Delete(':id')
  remove(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.dossiersService.remove(req.user.id, workspaceId, id);
  }
}