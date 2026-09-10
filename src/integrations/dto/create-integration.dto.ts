import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class CreateIntegrationDto {
  @IsPositive({ message: 'Selecione um provider válido' })
  integration_provider_id: number;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Informe uma URL válida' })
  @MaxLength(255)
  base_url?: string;

  /**
   * URL que o provider deve chamar com os eventos (o webhook é configurado
   * automaticamente ao criar o canal). Precisa ser alcançável a partir de onde
   * o provider roda: uma Evolution em container, por exemplo, não enxerga o
   * `localhost` do host.
   */
  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Informe uma URL de webhook válida' })
  @MaxLength(255)
  webhook_url?: string;

  /**
   * Credenciais do provider. O formato depende do provider escolhido:
   * Evolution espera { apiKey }; a Cloud API espera { phoneNumberId, wabaId, accessToken }.
   * Gravadas criptografadas e nunca devolvidas nas leituras.
   */
  @IsOptional()
  @IsObject({ message: 'Credenciais devem ser um objeto' })
  credentials?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
