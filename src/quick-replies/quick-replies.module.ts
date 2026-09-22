import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageModule } from '@/storage/storage.module';
import { QuickReplies } from './entities/quick-replies.entity';
import { QuickRepliesController } from './quick-replies.controller';
import { QuickRepliesRepository } from './quick-replies.repository';
import { QuickRepliesService } from './quick-replies.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuickReplies]), StorageModule],
  controllers: [QuickRepliesController],
  providers: [QuickRepliesService, QuickRepliesRepository],
  exports: [QuickRepliesService],
})
export class QuickRepliesModule {}
