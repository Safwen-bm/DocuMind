import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [AuthModule, PrismaModule, MailModule, NotificationsModule, PlansModule],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}