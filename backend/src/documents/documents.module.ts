// src/documents/documents.module.ts

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { ExportService } from './export.service';
import { UploadService } from './upload.service';
import { AuthModule } from '../auth/auth.module';
import { ActiviteModule } from '../activite/activite.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AuthModule,
    ActiviteModule,
    AiModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  providers: [DocumentsService, ExportService, UploadService],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}