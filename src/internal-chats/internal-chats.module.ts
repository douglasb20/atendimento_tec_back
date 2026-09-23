import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageService } from '@/storage/storage.service';
import { SystemSettingsModule } from '@/system-settings/system-settings.module';
import { UsersModule } from '@/users/users.module';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { InternalChatMessages } from './entities/internal-chat-messages.entity';
import { InternalChats } from './entities/internal-chats.entity';
import { InternalChatRetentionService } from './internal-chat-retention.service';
import { InternalChatsController } from './internal-chats.controller';
import { InternalChatsRepository } from './internal-chats.repository';
import { InternalChatsService } from './internal-chats.service';

/**
 * Chat interno: conversa direta entre usuários do portal.
 *
 * ⚠️ O `forFeature` é obrigatório mesmo com `autoLoadEntities: true`. Sem ele o
 * boot passa e é a **primeira consulta** que quebra, com "No metadata for X was
 * found" - erro que já apareceu neste projeto quando as entidades de avisos
 * ficaram de fora.
 *
 * `WhatsappModule` entra por causa do gateway, que é onde vivem a sala
 * `user:<id>` e o `emitToUser`. O nome é histórico: o gateway atende o portal
 * inteiro, não só o WhatsApp. `forwardRef` porque a cadeia de imports daquele
 * módulo é circular.
 *
 * `StorageService` como provider local, e não via `StorageModule`, seguindo o
 * que `UsersModule` já faz.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InternalChats, InternalChatMessages]),
    UsersModule,
    // A retenção lê o prazo do catálogo de configurações.
    SystemSettingsModule,
    forwardRef(() => WhatsappModule),
  ],
  controllers: [InternalChatsController],
  providers: [
    InternalChatsService,
    InternalChatsRepository,
    StorageService,
    InternalChatRetentionService,
  ],
  exports: [InternalChatsService, InternalChatRetentionService],
})
export class InternalChatsModule {}
