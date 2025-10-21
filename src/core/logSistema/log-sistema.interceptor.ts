import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogSistemaService } from './log-sistema.service';
import { QueryStorageService } from 'core/query-storage/query-storage.service'; // Importa o storage de queries

@Injectable()
export class LogSistemaInterceptor implements NestInterceptor {
  constructor(
    private readonly logSistemaService: LogSistemaService,
    private readonly queryStorage: QueryStorageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Usuário capturado pelo Passport-JWT
    const queries = this.queryStorage.getQueries(); // Pega todas as queries armazenadas

    return next.handle().pipe(
      tap(async () => {
        if (!user?.id) return;
        // Após a requisição ser finalizada, salva no banco

        const ip =
          (request.headers['x-forwarded-for'] as string)?.split(',')[0] || // Pega o primeiro IP da lista de proxies
          request.socket?.remoteAddress || // Caso contrário, pega o endereço do socket
          request.ip; // Se nada funcionar, pega o IP direto

        const logdata = {
          rota: request.url,
          id_usuario: user?.id || null,
          ip: ip,
          method: request.method,
          datetime_request: new Date(),
          body: request.body,
          params: request.params,
          queries: queries, // Armazena todas as queries executadas
        };

        await this.logSistemaService.salvarLog(logdata);

        // Limpa as queries armazenadas após salvar
        this.queryStorage.clear();
      }),
    );
  }
}
