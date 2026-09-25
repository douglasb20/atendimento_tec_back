import { IsIn, IsInt, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

import { ChatbotType } from '../entities/chatbots.entity';

const TIPOS_VALIDOS: ChatbotType[] = ['entrada', 'saida', 'agendamento', 'complementar'];

export class CreateChatbotDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  @MaxLength(120)
  name: string;

  @IsIn(TIPOS_VALIDOS, { message: 'Tipo de chatbot inválido' })
  type: ChatbotType;

  /**
   * Canal em que este chatbot roda. Obrigatório para entrada/saída/
   * agendamento; ausente/nulo para complementar (subfluxo não amarra a canal).
   */
  @ValidateIf((dto: CreateChatbotDto) => dto.type !== 'complementar')
  @IsInt({ message: 'Selecione um canal válido' })
  channel_id?: number | null;
}
