import { IsArray, IsInt } from 'class-validator';

export class UpdateDepartmentUsersDto {
  @IsArray({ message: 'Informe os usuários como lista' })
  @IsInt({ each: true, message: 'Usuário inválido' })
  user_ids: number[];
}
