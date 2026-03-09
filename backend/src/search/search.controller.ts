// src/search/search.controller.ts

import { Controller, Get, Query, UseGuards, Request, Param } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get(':workspaceId')
  search(
    @Request() req,
    @Param('workspaceId') workspaceId: string,
    @Query('q') q: string,
  ) {
    return this.searchService.search(req.user.id, workspaceId, q || '');
  }
}