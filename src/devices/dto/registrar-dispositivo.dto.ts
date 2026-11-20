import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Corpo do `POST /devices`. */
export class RegistrarDispositivoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nome?: string | null;
}

/** Corpo do `POST /devices/remover`. */
export class RemoverDispositivoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token: string;
}
