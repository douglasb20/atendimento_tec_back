import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Corpo do `POST /auth/mobile/refresh`: o app guarda o refresh no aparelho. */
export class RefreshMobileDto {
  @IsString({ message: 'O refresh token deve ser texto' })
  @IsNotEmpty({ message: 'Informe o refresh token' })
  refresh_token: string;
}

/** Corpo do `POST /auth/mobile/logout`. Sem token, a saída só confirma. */
export class LogoutMobileDto {
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
