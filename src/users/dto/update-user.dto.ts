import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

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
}
