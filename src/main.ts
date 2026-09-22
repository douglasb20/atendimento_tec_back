import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import * as path from 'path';

import { AppModule } from './app.module';
import { origensPermitidas } from './core/origens-permitidas';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      prefix: 'TecnicosApi',
    }),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origensPermitidas(),
    // Sem isto o navegador não envia os cookies de sessão em requisição
    // cross-origin - e em produção front e API estão em subdomínios distintos.
    // Note que `credentials: true` é incompatível com `origin: '*'`: a origem
    // precisa ser explícita, e é o que `origensPermitidas()` devolve.
    credentials: true,
  });

  // Popula `req.cookies`, de onde a JwtStrategy lê o access token.
  app.use(cookieParser());

  // aumenta o limite de tamanho aceito (por exemplo, 10MB)
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  app.useStaticAssets(path.resolve(process.cwd(), 'files'), { prefix: '/files/' });

  const queue = app.get<Queue>('BullQueue_whatsapp-messages-queue');

  queue.client
    .then((client) => client.ping())
    .then(() => console.log('Redis conectado ao Bull ✔'))
    .catch((err) => console.error('Erro ao conectar no Redis Bull:', err));

  // `APP_ENV` guarda a porta, não o ambiente - o nome engana, mas é o que os
  // ambientes existentes já usam. `PORT` é o nome convencional e tem
  // precedência; sem nenhuma das duas, 3001.
  await app.listen(process.env.PORT || process.env.APP_ENV || 3001);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
