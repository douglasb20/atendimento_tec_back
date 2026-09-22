import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

// Sem controller: o storage é consumido pelos outros módulos, nunca por HTTP
// direto. O `StorageController` que existia aqui era código de teste - expunha
// `POST /storage/presigned-url` sem guard nenhum, devolvendo a qualquer um da
// internet uma URL de escrita assinada no bucket de produção. As URLs legítimas
// saem de `/users/sign-avatar` e `/support-chats/sign-media-post`, autenticadas.
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
