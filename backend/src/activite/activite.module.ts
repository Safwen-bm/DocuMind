import { Global, Module } from '@nestjs/common';
import { ActiviteService } from './activite.service';

@Global()
@Module({
  providers: [ActiviteService],
  exports: [ActiviteService],
})
export class ActiviteModule {}