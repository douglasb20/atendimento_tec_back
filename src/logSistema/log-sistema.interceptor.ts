import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LogSistemaService } from './log-sistema.service';
import { QueryStorageService } from 'query-storage/query-storage.service'; // Importa o storage de queries

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
        const logdata = {
          rota: request.url,
          id_usuario: user?.id || null,
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
