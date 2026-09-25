import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/**
 * Cria uma conversa do zero, sem esperar uma mensagem chegar pelo webhook -
 * o atendente escolhe um contato já cadastrado (`contact_id`) OU digita um
 * número novo (`phone` + `name`). A validação de "exatamente um dos dois"
 * fica no service (`SupportChatsService.criarNova`), não dá para expressar
 * com decorators simples.
 */
export class CreateSupportChatDto {
  @IsInt()
  @IsPositive()
  channel_id: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  contact_id?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Nome do contato - obrigatório só quando `phone` vem preenchido. */
  @IsOptional()
  @IsString()
  @MaxLength(90)
  name?: string;
}
