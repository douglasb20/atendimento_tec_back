import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '@/auth/auth.module';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsRepository } from './custom-fields.repository';
import { CustomFieldsService } from './custom-fields.service';
import { ClientCustomValues } from './entities/client-custom-values.entity';
import { ContactCustomValues } from './entities/contact-custom-values.entity';
import { CustomFields } from './entities/custom-fields.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomFields, ContactCustomValues, ClientCustomValues]),
    AuthModule,
  ],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService, CustomFieldsRepository],
  // Contatos e clientes resolvem os campos ao gravar os valores.
  exports: [CustomFieldsService, CustomFieldsRepository],
})
export class CustomFieldsModule {}
