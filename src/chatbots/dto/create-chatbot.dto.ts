import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import type { ChatbotType } from '../entities/chatbots.entity';

const TIPOS_VALIDOS: ChatbotType[] = ['entrada', 'saida', 'agendamento', 'complementar'];

export class CreateChatbotDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  @MaxLength(120)
  name: string;

  @IsIn(TIPOS_VALIDOS, { message: 'Tipo de chatbot inválido' })
  type: ChatbotType;

  /** Compatibilidade com clientes antigos: vínculos agora são editados no canal. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(0, { message: 'Configure os fluxos na edição do canal, na aba Chatbot' })
  channel_ids?: number[];
}
