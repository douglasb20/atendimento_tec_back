import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    console.log(WhatsappGateway.name);
    console.log(`Cliente conectado: ${client.id}`);
    this.clients.set(client.id, client);
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
    if (client) client.emit(event, data);
  }
}
