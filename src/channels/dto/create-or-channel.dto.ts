import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrChannelDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;

  /**
   * Integração que atende este canal. Opcional: sem ela, o canal cai na
   * integração marcada como padrão — o que basta enquanto houver um servidor
   * de provider só. Informar passa a importar quando coexistem vários
   * (produção e homologação, ou um cliente com Evolution própria).
   */
  @IsOptional()
  @IsInt({ message: 'Selecione uma integração válida' })
  integration_id?: number;
}
