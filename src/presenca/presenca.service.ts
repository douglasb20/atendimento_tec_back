import { Injectable } from '@nestjs/common';

/**
 * Como o usuário aparece para os colegas.
 *
 * `ausente` não é um estado que a pessoa escolhe: é derivado do tempo sem mexer
 * no mouse ou no teclado. Quem está com a aba aberta mas saiu da mesa continua
 * conectado, e mostrá-lo como disponível faria o colega esperar resposta que
 * não vem.
 */
export type EstadoPresenca = 'online' | 'ausente' | 'offline';

/**
 * Depois de quanto tempo parado a pessoa passa a aparecer como ausente.
 *
 * Dez minutos é o padrão do Slack e do Teams: não acusa ausência numa pausa
 * curta - ler um chamado longo, atender o telefone - e ainda assim mostra quem
 * saiu de fato.
 */
export const MINUTOS_ATE_AUSENTE = 10;

const MS_ATE_AUSENTE = MINUTOS_ATE_AUSENTE * 60 * 1000;

/**
 * Quem está conectado agora, e em que estado.
 *
 * A fonte do dado é o WebSocket: o gateway avisa a cada conexão e desconexão, e
 * este serviço só guarda o resultado. Não há tabela nem cron - presença é
 * estado de agora, e o que vale é quem tem socket aberto neste instante.
 *
 * ⚠️ O estado vive na memória do processo. Com uma instância do backend isso é
 * equivalente a guardá-lo no Redis; com duas, cada uma enxergaria só os próprios
 * conectados e a lista sairia incompleta. A troca é local a este arquivo: a
 * interface pública não muda, e os chamadores não sabem onde o dado mora.
 */
@Injectable()
export class PresencaService {
  /**
   * Sockets abertos por usuário.
   *
   * É um conjunto, e não um contador, porque a mesma aba pode reconectar sem
   * que a desconexão anterior tenha sido processada - somando e subtraindo, o
   * número derivaria com o tempo. Com o id do socket, reprocessar o mesmo
   * evento é inofensivo.
   */
  private readonly socketsPorUsuario = new Map<number, Set<string>>();

  /**
   * Quando cada um interagiu pela última vez.
   *
   * Guardado por **usuário**, e não por socket: quem tem duas abas abertas e
   * está mexendo numa delas está presente, e a aba parada não pode deixá-lo
   * amarelo.
   */
  private readonly ultimaAtividade = new Map<number, number>();

  /**
   * Registra um socket novo.
   *
   * @returns `true` se o usuário *passou* a estar online agora - ou seja, este
   * é o primeiro socket dele. Quem chama usa isso para só avisar os outros na
   * transição, e não a cada aba que a pessoa abre.
   */
  conectou(userId: number, socketId: string): boolean {
    // Conectar é atividade: sem isto, quem acabou de entrar nasceria ausente.
    this.ultimaAtividade.set(userId, Date.now());

    const sockets = this.socketsPorUsuario.get(userId);

    if (!sockets) {
      this.socketsPorUsuario.set(userId, new Set([socketId]));
      return true;
    }

    sockets.add(socketId);
    return false;
  }

  /**
   * Remove um socket.
   *
   * @returns `true` se o usuário *ficou* offline - o socket que saiu era o
   * último. Enquanto restar uma aba aberta a pessoa continua online: fechar uma
   * das duas não pode apagá-la da lista dos outros.
   */
  desconectou(userId: number, socketId: string): boolean {
    const sockets = this.socketsPorUsuario.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);

    if (sockets.size > 0) return false;

    // Sem sockets, as chaves saem dos dois mapas: manter um Set vazio faria
    // `online()` devolver quem já saiu, e a atividade de quem não está
    // conectado não interessa a ninguém.
    this.socketsPorUsuario.delete(userId);
    this.ultimaAtividade.delete(userId);

    return true;
  }

  /**
   * O usuário mexeu no mouse ou no teclado.
   *
   * @returns `true` se ele **estava** ausente e voltou - é a transição que os
   * colegas precisam ver. Batidas de quem já estava ativo não emitem nada: o
   * front avisa a cada poucos minutos, e um evento por batida encheria o socket
   * de ruído.
   */
  registrarAtividade(userId: number): boolean {
    if (!this.socketsPorUsuario.has(userId)) return false;

    const estavaAusente = this.estado(userId) === 'ausente';

    this.ultimaAtividade.set(userId, Date.now());

    return estavaAusente;
  }

  /** Em que estado o usuário aparece para os colegas. */
  estado(userId: number): EstadoPresenca {
    if (!this.socketsPorUsuario.has(userId)) return 'offline';

    const ultima = this.ultimaAtividade.get(userId);

    // Conectado sem atividade registrada não deveria acontecer - `conectou`
    // grava -, mas tratar como online é o mais próximo da verdade: ele
    // conectou agora há pouco.
    if (!ultima) return 'online';

    return Date.now() - ultima >= MS_ATE_AUSENTE ? 'ausente' : 'online';
  }

  /** Atalho para quem só precisa saber se está conectado. */
  estaOnline(userId: number): boolean {
    return this.socketsPorUsuario.has(userId);
  }

  /** Os ids de quem tem pelo menos um socket aberto, em qualquer estado. */
  online(): number[] {
    return [...this.socketsPorUsuario.keys()];
  }

  /**
   * O estado de cada conectado, para quem acabou de entrar montar a lista.
   *
   * Quem não aparece aqui está offline - mandar a lista inteira de usuários
   * inativos seria desperdício, já que o padrão da tela é offline.
   */
  estadosAtuais(): Record<number, EstadoPresenca> {
    const mapa: Record<number, EstadoPresenca> = {};

    for (const userId of this.socketsPorUsuario.keys()) {
      mapa[userId] = this.estado(userId);
    }

    return mapa;
  }

  /**
   * Quem cruzou o limite de inatividade desde a última verificação.
   *
   * Chamado por um intervalo no gateway: sem ele, ninguém ficaria amarelo até
   * que outra coisa forçasse uma leitura - a ausência só apareceria quando o
   * colega recarregasse a tela.
   */
  ausentesDesdeAUltimaVerificacao(jaAvisados: Set<number>): number[] {
    const novos: number[] = [];

    for (const userId of this.socketsPorUsuario.keys()) {
      if (this.estado(userId) === 'ausente' && !jaAvisados.has(userId)) novos.push(userId);
    }

    return novos;
  }
}
