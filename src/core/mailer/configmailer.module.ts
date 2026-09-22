import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { SystemSettingsModule } from '@/system-settings/system-settings.module';
import { ConfigMailerService } from './configmailer.service';
import * as path from 'node:path';

@Module({
  imports: [
    // Ciclo real: o mailer lê a configuração de e-mail do `SystemSettings`, e
    // o controller de lá invalida o transporte daqui ao salvar.
    forwardRef(() => SystemSettingsModule),
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
            // Caminho derivado do próprio arquivo, não do `cwd`: quem
            // dispara o processo decide o diretório de trabalho, e no deploy
            // isso muda sem aviso. Com `process.cwd()` o envio falhava em
            // produção, onde a pasta nem chegava a existir - o `nest-cli.json`
            // agora a copia para dentro do `dist`, que é o que o Docker leva.
            dir: path.join(__dirname, '..', '..', 'templates', 'mail'),
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
  // Exportado para quem importa o módulo poder injetar o service. Sem isto o
  // `AuthModule` precisava declará-lo como provider próprio, criando uma
  // segunda instância com a mesma configuração.
  exports: [ConfigMailerService],
})
export class ConfigMailerModule {}
