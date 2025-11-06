import { Controller, Post } from '@nestjs/common';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('/presigned-url')
  async getPresignedUrl() {
    const key = 'user/avatar/gatinho-shrek.jpg';
    return this.storageService.createPresignedPost(key);
  }
}
