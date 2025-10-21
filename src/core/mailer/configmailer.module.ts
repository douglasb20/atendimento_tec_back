import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigMailerService } from './configmailer.service';
import * as path from 'node:path';

@Module({
  imports: [
    MailerModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        return {
          transport: {
            host: configService.get('MAIL_HOST'),
            secure: false,
            port: configService.get('MAIL_PORT'),
            auth: {
              user: configService.get('MAIL_USER'),
              pass: configService.get('MAIL_PASS'),
            },
            ignoreTLS: false,
          },
          defaults: {
            from: configService.get('MAIL_FROM'),
          },
          template: {
            dir: path.join(__dirname, '..', '..', '/templates/mail'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [ConfigMailerService],
})
export class ConfigMailerModule {}
