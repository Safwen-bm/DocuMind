// src/search/search.module.ts

import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, PrismaModule, AiModule],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}