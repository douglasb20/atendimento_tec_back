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
import { JwtPayload } from '@types';
import { Users } from '@/users/entities/users.entity';

type ClientInfo = {
  socket: Socket;
  user: Users;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly authService: AuthService) {}

  @WebSocketServer()
  server: Server;

  private clients = new Map<string, ClientInfo>();

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;

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
