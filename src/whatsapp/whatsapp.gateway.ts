import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

import { AuthService } from 'auth/auth.service';
import { COOKIE_ACCESS } from 'core/cookies-de-sessao';
import { origensPermitidas } from 'core/origens-permitidas';
import { JwtPayload } from '@types';
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
  constructor(private readonly authService: AuthService) {}

  @WebSocketServer()
  server: Server;

  private clients = new Map<string, ClientInfo>();

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
    } catch (error) {
      console.log(`Cliente ${client.id} desconectado: ${error.message}`);
      client.disconnect();
      return;
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
    this.clients.delete(client.id);
  }

  @SubscribeMessage('')
  handleChatOpened(@MessageBody() data: any) {
    console.log('Chat aberto:', data);
  }

  emitEvent(event: string, data: any) {
    this.server.emit(event, data); // envia pra todos conectados
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
