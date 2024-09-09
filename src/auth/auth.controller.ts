import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SigninDto } from 'users/dto/signin.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() userDto: SigninDto) {
    return this.authService.signin(userDto.email, userDto.password);
  }

  @Post('forgotten_password/:email')
  @HttpCode(HttpStatus.OK)
  async forgottenPassword(@Param('email') email: string) {
    return this.authService.forgottenPassword(email);
  }
}
