import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { TipoAnexoChannel } from '../entities/channels.entity';

/**
 * Teto das mensagens automáticas.
 *
 * O WhatsApp aceita bem mais, mas saudação é recado curto: o limite existe
 * para a tela poder mostrar o contador e para o texto caber na bolha sem
 * virar parede.
 */
const LIMITE_MENSAGEM = 1000;

const TIPOS_ANEXO: TipoAnexoChannel[] = ['image', 'video', 'audio', 'document'];

export class CreateOrChannelDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;

  /**
   * Enviada sozinha quando um contato abre uma conversa nova.
   *
   * Vazio desliga o envio - é assim que se desfaz o cadastro sem precisar de
   * uma opção "ativar/desativar" à parte.
   */
  @IsOptional()
  @IsString({ message: 'A mensagem de saudação precisa ser um texto' })
  @MaxLength(LIMITE_MENSAGEM, {
    message: `A mensagem de saudação deve ter no máximo ${LIMITE_MENSAGEM} caracteres`,
  })
  mensagem_saudacao?: string | null;

  /**
   * O anexo é opcional, mas **indivisível**: sem a key não há o que enviar, e
   * sem nome/mimetype/tipo o provider não sabe como tratar o arquivo. Por isso
   * os quatro campos são exigidos juntos quando a key vem - mesma regra de
   * `quick_replies`.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  saudacao_anexo_key?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.saudacao_anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo da saudação precisa de um nome de arquivo' })
  @MaxLength(255)
  saudacao_anexo_nome?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.saudacao_anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo da saudação precisa de um mimetype' })
  @MaxLength(100)
  saudacao_anexo_mimetype?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.saudacao_anexo_key))
  @IsIn(TIPOS_ANEXO, {
    message: `O tipo do anexo da saudação deve ser um de: ${TIPOS_ANEXO.join(', ')}`,
  })
  saudacao_anexo_tipo?: TipoAnexoChannel | null;

  /** Enviada ao finalizar o atendimento. Mesmas regras da saudação. */
  @IsOptional()
  @IsString({ message: 'A mensagem de despedida precisa ser um texto' })
  @MaxLength(LIMITE_MENSAGEM, {
    message: `A mensagem de despedida deve ter no máximo ${LIMITE_MENSAGEM} caracteres`,
  })
  mensagem_despedida?: string | null;

  /** Anexo da despedida - independente do de saudação, mesmas regras dele. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  despedida_anexo_key?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.despedida_anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo da despedida precisa de um nome de arquivo' })
  @MaxLength(255)
  despedida_anexo_nome?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.despedida_anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo da despedida precisa de um mimetype' })
  @MaxLength(100)
  despedida_anexo_mimetype?: string | null;

  @ValidateIf((dto: CreateOrChannelDto) => Boolean(dto.despedida_anexo_key))
  @IsIn(TIPOS_ANEXO, {
    message: `O tipo do anexo da despedida deve ser um de: ${TIPOS_ANEXO.join(', ')}`,
  })
  despedida_anexo_tipo?: TipoAnexoChannel | null;

  /** Liga a resolução automática por inatividade - os três campos abaixo só
   * têm efeito com este ligado. */
  @IsOptional()
  @IsBoolean({ message: 'inatividade_ativa deve ser verdadeiro ou falso' })
  inatividade_ativa?: boolean;

  /** Minutos sem mensagem de nenhum dos dois lados até finalizar sozinho.
   * Teto de 90 é só trava de UI/API, sem config própria. */
  @ValidateIf((dto: CreateOrChannelDto) => dto.inatividade_ativa === true)
  @IsInt({ message: 'Informe os minutos para resolver por inatividade' })
  @Min(1, { message: 'O tempo para resolver deve ser de ao menos 1 minuto' })
  @Max(90, { message: 'O tempo para resolver deve ser de no máximo 90 minutos' })
  inatividade_resolver_em_minutos?: number | null;

  /**
   * Minutos antes de `inatividade_resolver_em_minutos` em que o aviso é
   * enviado - precisa ser menor que ele. Essa comparação entre os dois
   * campos é validada no service (`ChannelsService`), não aqui: o
   * `class-validator` não tem um jeito direto de comparar dois campos do
   * mesmo DTO sem um validador customizado, e o projeto não tem precedente
   * disso - mais simples validar onde já se decide o resto da regra de
   * negócio.
   */
  @ValidateIf((dto: CreateOrChannelDto) => dto.inatividade_ativa === true)
  @IsInt({ message: 'Informe os minutos para avisar antes da resolução' })
  @Min(1, { message: 'O tempo para avisar deve ser de ao menos 1 minuto' })
  inatividade_avisar_em_minutos?: number | null;

  /** Enviada ao cliente ao se aproximar da resolução por inatividade. Mesmas
   * variáveis de `mensagem_despedida`, sem anexo. */
  @IsOptional()
  @IsString({ message: 'A mensagem de aviso precisa ser um texto' })
  @MaxLength(LIMITE_MENSAGEM, {
    message: `A mensagem de aviso deve ter no máximo ${LIMITE_MENSAGEM} caracteres`,
  })
  inatividade_mensagem_aviso?: string | null;

  /** Ao finalizar por inatividade, envia também `mensagem_despedida` - opt-in. */
  @IsOptional()
  @IsBoolean({ message: 'inatividade_enviar_despedida deve ser verdadeiro ou falso' })
  inatividade_enviar_despedida?: boolean;

  /**
   * Os setores atendidos por este canal. Pode ser mais de um, como no
   * Whaticket - hoje é só a associação; quem escolhe entre eles para cada
   * conversa nova é o chatbot por fluxo, ainda não construído.
   *
   * Ausente, os vínculos ficam como estão; `[]` tira o canal de todos.
   */
  @IsOptional()
  @IsArray({ message: 'Informe os setores como lista' })
  @IsInt({ each: true, message: 'Setor inválido' })
  department_ids?: number[];
}
