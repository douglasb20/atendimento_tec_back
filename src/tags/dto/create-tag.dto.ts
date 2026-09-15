import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(60)
  name: string;

  /**
   * Cor em `#RRGGBB`. O ColorPicker do front devolve o hex sem o `#`, e a
   * normalização acontece lá — aqui o formato completo é obrigatório, para o
   * banco não misturar as duas grafias.
   */
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Informe a cor no formato #RRGGBB' })
  color: string;

  /** Cor do texto sobre o fundo. Omitido, fica `light`. */
  @IsOptional()
  @IsIn(['light', 'dark'], { message: 'A cor do texto deve ser light ou dark' })
  text_color?: 'light' | 'dark';
}
