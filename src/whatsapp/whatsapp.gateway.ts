import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Interval } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

import { AuthService } from 'auth/auth.service';
import { COOKIE_ACCESS } from 'core/cookies-de-sessao';
import { origensPermitidas } from 'core/origens-permitidas';
import { JwtPayload } from '@types';
import { EstadoPresenca, PresencaService } from '@/presenca/presenca.service';
import { PermissionService } from '@/permissions/permission.service';
import { Users } from '@/users/entities/users.entity';

type ClientInfo = {
  socket: Socket;
  user: Users;
};

@WebSocketGateway({
  // Mesma lista do CORS da API. O handshake já valida o JWT antes de entrar na
  // sala, mas manter as duas portas com a mesma regra evita que uma origem
  // recusada no HTTP passe pelo WebSocket.
  cors: {
    origin: origensPermitidas(),
    // O handshake precisa carregar os cookies de sessão: com o token httpOnly,
    // é por eles que o socket se autentica.
    credentials: true,
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly authService: AuthService,
    private readonly presencaService: PresencaService,
    private readonly permissionService: PermissionService,
  ) {}

  @WebSocketServer()
  server: Server;

  private clients = new Map<string, ClientInfo>();

  /**
   * Quem já foi anunciado como ausente.
   *
   * Sem este registro a varredura de minuto em minuto reemitiria o mesmo
   * evento para sempre, enquanto a pessoa estivesse longe da mesa.
   */
  private readonly ausentesAvisados = new Set<number>();

  /**
   * Extrai o access token do handshake.
   *
   * O caminho normal é o cookie: como ele é httpOnly, o cliente não consegue
   * lê-lo para montar `auth.token` - mas o navegador o envia no handshake, e é
   * de lá que ele sai. O `auth.token` continua aceito para clientes que ainda o
   * enviem (e para testes que não passam por navegador).
   */
  private tokenDoHandshake(client: Socket): string | null {
    const doCookie = client.handshake.headers?.cookie
      ?.split(';')
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith(`${COOKIE_ACCESS}=`))
      ?.slice(COOKIE_ACCESS.length + 1);

    // `decodeURIComponent` porque o Express escapa o valor ao gravar.
    return doCookie ? decodeURIComponent(doCookie) : (client.handshake.auth?.token ?? null);
  }

  async handleConnection(client: Socket) {
    const token = this.tokenDoHandshake(client);

    if (!token) {
      console.log(`Cliente ${client.id} desconectado: Token não fornecido.`);
      client.disconnect();
      return;
    }

    try {
      const payload = verify(token, process.env.ACCESS_JWT_SECRET) as unknown as JwtPayload;

      const user = await this.authService.validateUser(payload);

      console.log(`Cliente conectado: ${client.id}`);

      const ClientInfo: ClientInfo = {
        socket: client,
        user,
      };
      this.clients.set(client.id, ClientInfo);

      client.join(`user:${user.id}`);

      // Só avisa na transição offline→online. Quem abre uma segunda aba já
      // estava online, e repetir o evento faria a lista dos outros piscar sem
      // nada ter mudado.
      if (this.presencaService.conectou(user.id, client.id)) {
        this.ausentesAvisados.delete(user.id);
        this.emitirPresenca(user.id, 'online');
      }

      // O estado atual vai só para quem acabou de chegar: quem já estava
      // conectado tem a lista em dia pelos eventos.
      client.emit('presenca:atual', { estados: this.presencaService.estadosAtuais() });
    } catch (error) {
      console.log(`Cliente ${client.id} desconectado: ${error.message}`);
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);

    // Lido *antes* do delete: depois dele não há mais como saber de quem era o
    // socket, e sem o usuário não dá para atualizar a presença. Pode não existir
    // quando a conexão cai antes de o handshake terminar.
    const info = this.clients.get(client.id);

    this.clients.delete(client.id);

    if (!info) return;

    // Só na transição online→offline: fechar uma de duas abas não tira ninguém
    // da lista, porque a outra continua conectada.
    if (this.presencaService.desconectou(info.user.id, client.id)) {
      this.ausentesAvisados.delete(info.user.id);
      this.emitirPresenca(info.user.id, 'offline');
    }
  }

  /**
   * O front avisa que a pessoa mexeu no mouse ou no teclado.
   *
   * ⚠️ É o **único** evento que o front envia pelo socket em todo o portal -
   * o resto do tráfego é servidor→cliente. Vem daqui porque uma chamada HTTP a
   * cada retomada, vezes o número de atendentes, seria ruído constante no log
   * de auditoria (que registra toda requisição autenticada e suas queries).
   */
  @SubscribeMessage('presenca:atividade')
  handleAtividade(@ConnectedSocket() client: Socket) {
    const info = this.clients.get(client.id);
    if (!info) return;

    // Só a volta de ausente→online emite. O front bate de tempos em tempos, e
    // avisar a cada batida encheria o socket sem nada mudar na tela.
    if (this.presencaService.registrarAtividade(info.user.id)) {
      this.ausentesAvisados.delete(info.user.id);
      this.emitirPresenca(info.user.id, 'online');
    }
  }

  /** Um lugar só para o formato do evento, usado em quatro pontos. */
  private emitirPresenca(userId: number, estado: EstadoPresenca) {
    this.emitEvent('presenca:mudou', {
      user_id: userId,
      estado,
      // Mantido para não quebrar quem já lê o campo antigo.
      online: estado !== 'offline',
    });
  }

  /**
   * Varre os conectados atrás de quem cruzou o limite de inatividade.
   *
   * Sem esta varredura ninguém ficaria amarelo: o estado é calculado por
   * tempo, e sem alguém olhando o relógio a mudança só apareceria quando o
   * colega recarregasse a tela.
   *
   * Um minuto é a granularidade da transição - com o limite em dez, errar por
   * até um minuto não muda nada para quem lê.
   */
  @Interval(60_000)
  verificarAusentes() {
    for (const userId of this.presencaService.ausentesDesdeAUltimaVerificacao(
      this.ausentesAvisados,
    )) {
      this.ausentesAvisados.add(userId);
      this.emitirPresenca(userId, 'ausente');
    }
  }

  @SubscribeMessage('')
  handleChatOpened(@MessageBody() data: any) {
    console.log('Chat aberto:', data);
  }

  emitEvent(event: string, data: any) {
    this.server.emit(event, data); // envia pra todos conectados
  }

  /**
   * Emite o estado de uma conversa só para quem tem permissão de vê-la; quem
   * perdeu o acesso recebe `whatsapp:chat_removed` no lugar, para tirá-la da
   * lista.
   *
   * `whatsapp:chat_state` sempre foi broadcast geral (`emitEvent`), e a
   * permissão `support.chat:view_others` (que restringe um atendente a ver só
   * os próprios atendimentos `EM_ANDAMENTO`) só era aplicada na consulta REST
   * inicial - por isso o filtro "funcionava" só até o próximo reload: quando
   * outro atendente assumia um atendimento, o socket avisava geral, e quem não
   * deveria ver aquela conversa a via do mesmo jeito até recarregar a página.
   *
   * Só parar de emitir não bastava: a conversa já estava na lista de quem a
   * via (carregada enquanto ainda estava em fila, sem dono, visível a todos).
   * Sem um evento próprio de remoção, ela ficava presa lá para sempre - nada
   * no front tira uma conversa da lista a não ser ela ser finalizada.
   *
   * `dono` é o `user_id` da conversa (ou `null`/`undefined` para uma que ainda
   * está em fila, sem dono - essa sempre pode ser vista por todos, é o mesmo
   * critério do filtro em `SupportChatsRepository.findAllSupportChats`).
   */
  async emitSupportChatState(dono: number | null | undefined, event: string, data: any) {
    for (const info of this.clients.values()) {
      if (await this.podeVerAtendimento(info.user, dono)) {
        info.socket.emit(event, data);
      } else {
        info.socket.emit('whatsapp:chat_removed', { id: data?.id });
      }
    }
  }

  private async podeVerAtendimento(user: Users, dono: number | null | undefined): Promise<boolean> {
    if (!dono) return true;
    if (Number(user.is_superuser)) return true;
    if (Number(user.id) === Number(dono)) return true;

    return this.permissionService.hasPermission(user.id, ['support.chat:view_others']);
  }

  emitToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) client.socket.emit(event, data);
  }

  emitToUser(userId: number, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  getUserSocketIds(userId: number): string[] {
    const ids: string[] = [];
    for (const [sid, info] of this.clients.entries()) {
      if (info.user.id === userId) ids.push(sid);
    }
    return ids;
  }
}
