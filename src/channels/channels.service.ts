import { Injectable } from '@nestjs/common';
import { ChannelsRepository } from './channels.repository';

@Injectable()
export class ChannelsService {

  constructor(private readonly channelsRepository: ChannelsRepository) { }
  
  async getActiveChannels() {
    return this.channelsRepository.findActives();
  }
}
