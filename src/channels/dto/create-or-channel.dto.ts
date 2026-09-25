import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Teto das mensagens automáticas.
 *
 * O WhatsApp aceita bem mais, mas saudação é recado curto: o limite existe
 * para a tela poder mostrar o contador e para o texto caber na bolha sem
 * virar parede.
 */
const LIMITE_MENSAGEM = 1000;

export class CreateOrChannelDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;

  /**
   * Integração que atende este canal. Opcional: sem ela, o canal cai na
   * integração marcada como padrão - o que basta enquanto houver um servidor
   * de provider só. Informar passa a importar quando coexistem vários
   * (produção e homologação, ou um cliente com Evolution própria).
   */
  // `ValidateIf` em vez de `IsOptional`: o front manda `null` explicitamente
  // para dizer "usar a integração padrão", e o `IsOptional` sozinho deixaria
  // passar, mas o `IsInt` recusaria o nulo vindo no corpo.
  @ValidateIf((_, valor) => valor !== null && valor !== undefined)
  @IsInt({ message: 'Selecione uma integração válida' })
  integration_id?: number | null;

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

  /** Enviada ao finalizar o atendimento. Mesmas regras da saudação. */
  @IsOptional()
  @IsString({ message: 'A mensagem de despedida precisa ser um texto' })
  @MaxLength(LIMITE_MENSAGEM, {
    message: `A mensagem de despedida deve ter no máximo ${LIMITE_MENSAGEM} caracteres`,
  })
  mensagem_despedida?: string | null;

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
