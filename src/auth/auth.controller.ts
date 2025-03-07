import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { SigninDto } from 'users/dto/signin.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() userDto: SigninDto, @Req() request: Request) {
    return this.authService.signin(userDto.email, userDto.password, request);
  }

  @Post('forgotten_password/:email')
  @HttpCode(HttpStatus.OK)
  async forgottenPassword(@Param('email') email: string) {
    return this.authService.forgottenPassword(email);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: any, @Req() request: Request) {
    const { refreshToken } = body;
    return this.authService.refresh(refreshToken, request);
  }
}
