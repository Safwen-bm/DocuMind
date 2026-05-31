import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiStreamGateway } from './ai.gateway';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [AuthModule, PrismaModule, PlansModule],
  providers: [AiService, AiStreamGateway],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}