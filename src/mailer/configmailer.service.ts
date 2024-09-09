import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';
import { encrypt } from 'Utils';

@Injectable()
export class ConfigMailerService {
  constructor(private readonly mailerService: MailerService) {}

  async SendForgottenPassword(user_name: string, id: number, email: string) {
    const date = Math.floor(new Date().getTime() / 1000.0) + 60 * 60 * 5;
    const userData = {
      user_name,
      id,
      email,
      expires: date,
    };
    const dataString = JSON.stringify(userData);
    const token = encrypt(dataString);
    const urlToken = `http://localhost:3000/auth/request_password/${token}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Pedido de Recuperação de Senha',
      // html: '<p>Envio certo</p>',
      template: 'forgotten_password',
      context: {
        nome: user_name,
        url: urlToken,
      },
    });
  }
}
