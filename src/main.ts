import { NestFactory } from '@nestjs/core';
import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
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
    origin: 'http://localhost:3000',
  });
  await app.listen(process.env.APP_ENV || 3001);
}
bootstrap();
