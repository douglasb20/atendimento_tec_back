import { IsNotEmpty } from 'class-validator';

export class CreatePermissionDto {
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  label: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  permission_module_id: number;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;
}
