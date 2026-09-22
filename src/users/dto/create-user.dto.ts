import { Transform } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;

  /** Opcional, como no contato. */
  @IsOptional()
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  last_name?: string | null;

  @IsString()
  @IsEmail({}, { message: (opt) => `Formato do campo ${opt.property} inválido` })
  email: string;

  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  password: string;

  @IsOptional()
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  avatar_url?: string;

  /**
   * Custo/hora do atendente. **Obsoleto** - o formulário deixou de enviá-lo.
   *
   * Continua aceito para não quebrar chamadas antigas (os `.http` ainda o
   * mandam). Alimentava um cálculo em `supports`, módulo parado, cuja consulta
   * nem roda: usa `TIME_TO_SEC`/`TIMEDIFF`, funções de MySQL, num PostgreSQL.
   */
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: (opt) => `Campo ${opt.property} aceita somente formato numérico` })
  valor_hora?: number;

  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsOptional()
  role?: string;

  /**
   * O grupo de permissão do usuário - é ele que define o acesso.
   *
   * Nulo é válido e significa sem permissão alguma, que é como um cadastro
   * nasce até alguém decidir o que ele pode fazer. Não confundir com `role`
   * acima, coluna varchar legada que nenhum guard lê.
   */
  @IsOptional()
  @IsInt({ message: (opt) => `Campo ${opt.property} aceita somente formato numérico` })
  permission_group_id?: number | null;
}
