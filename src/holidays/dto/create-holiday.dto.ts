import { IsBoolean, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(120)
  name: string;

  @IsBoolean()
  recurring: boolean;

  /** Obrigatório só quando `recurring = false` - feriado móvel, data completa. */
  @ValidateIf((dto) => !dto.recurring)
  @IsInt()
  @Min(1900)
  @Max(2200)
  year?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(1)
  @Max(31)
  day: number;
}
