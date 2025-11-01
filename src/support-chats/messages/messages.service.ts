import { Injectable } from '@nestjs/common';

@Injectable()
export class MessagesService {
  async hello() {
    return 'Hello, World!';
  }
}
