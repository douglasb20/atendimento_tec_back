import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

import { CreateChatbotDto } from './create-chatbot.dto';

/**
 * Todos os campos de `CreateChatbotDto` são opcionais; o que não vier fica
 * como está. Mais `active` (ativar/desativar) e `settings` (modal
 * "Configurações" - jsonb livre, validado na tela, não no DTO).
 */
export class UpdateChatbotDto extends PartialType(CreateChatbotDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
