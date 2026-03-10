// src/comments/comments.module.ts

import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

// NotificationsModule is @Global() so no need to import it here —
// NotificationsService is already available app-wide via injection.

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}