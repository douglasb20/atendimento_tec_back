import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';

import { AuthService } from 'auth/auth.service';
import { JwtPayload } from '@types';

type ClientInfo = {
  socket: Socket;
  user_id: number;
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
      // @ts-ignore
      const payload = verify(token, process.env.ACCESS_JWT_SECRET as PublicKey) as JwtPayload;

      const user = await this.authService.validateUser(payload);

      console.log(`Cliente conectado: ${client.id}`);
      this.clients.set(client.id, {
        socket: client,
        user_id: user.id,
      });
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

  emitEvent(event: string, data: any) {
    this.server.emit(event, data); // envia pra todos conectados
  }

  emitToClient(clientId: string, event: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) client.socket.emit(event, data);
  }
}
