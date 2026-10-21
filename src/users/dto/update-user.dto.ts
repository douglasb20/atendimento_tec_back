import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends CreateUserDto {
  lastlogin_at?: string;

  /**
   * Troca de senha por aqui: só usada em auto-edição, pela aba "Dados" do
   * perfil (`/users/meu-perfil`) - o CRUD administrativo de outros usuários
   * (`/users/:id`) não define senha, o convite por e-mail cuida disso. Sem
   * exigir a senha atual: a sessão já autenticada é a confirmação.
   */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha precisa ter ao menos 6 caracteres' })
  password?: string;

  @IsBoolean()
  @IsOptional()
  changed_avatar?: boolean;

  /** Ausente preserva a cor; obrigatória apenas no cadastro de atendente. */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Informe uma cor de agenda válida' })
  declare schedule_color: string;
}
