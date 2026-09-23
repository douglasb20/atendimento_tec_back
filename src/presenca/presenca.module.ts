import { Global, Module } from '@nestjs/common';

import { PresencaService } from './presenca.service';

/**
 * Presença dos usuários no portal.
 *
 * `@Global` porque o estado precisa ser único: o gateway escreve, e quem
 * consulta (o chat interno, hoje) tem de ler o mesmo mapa. Sem isso, cada
 * módulo que importasse este receberia a instância do seu próprio injetor em
 * alguns arranjos, e a lista de online divergiria conforme quem pergunta.
 */
@Global()
@Module({
  providers: [PresencaService],
  exports: [PresencaService],
})
export class PresencaModule {}
