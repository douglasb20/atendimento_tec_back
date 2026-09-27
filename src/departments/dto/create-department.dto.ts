import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  /** `#RRGGBB` - mesmo formato de `tags.color`. Opcional: setor pode ficar sem cor. */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Informe a cor no formato #RRGGBB' })
  color?: string | null;
}
