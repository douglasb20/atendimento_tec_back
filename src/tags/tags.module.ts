import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'auth/auth.module';
import { Tags } from './entities/tags.entity';
import { TagsController } from './tags.controller';
import { TagsRepository } from './tags.repository';
import { TagsService } from './tags.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tags]), AuthModule],
  controllers: [TagsController],
  providers: [TagsService, TagsRepository],
  // O módulo de clientes usa o repository para resolver os ids ao gravar as
  // etiquetas de um cliente.
  exports: [TagsService, TagsRepository],
})
export class TagsModule {}
