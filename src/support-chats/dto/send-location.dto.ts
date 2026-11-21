import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendLocationDto {
  @IsString()
  @IsNotEmpty()
  chat_id: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  /** O endereço legível, mostrado embaixo do mapa. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  endereco?: string;
}
