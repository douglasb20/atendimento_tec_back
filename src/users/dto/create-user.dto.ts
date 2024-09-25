export class CreateUserDto {
  name: string;
  email: string;
  password: string;
  valor_hora?: number;
  role?: string;
}
