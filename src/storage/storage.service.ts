// upload.service.ts
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private s3 = new S3Client({
    region: process.env.WASABI_REGION!,
    endpoint: process.env.WASABI_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.WASABI_ACCESS_KEY!,
      secretAccessKey: process.env.WASABI_SECRET_KEY!,
    },
  });

  async createPresignedPost(path: string): Promise<PresignedPost> {
    const fileKey = `${path}`;

    const result = await createPresignedPost(this.s3, {
      Bucket: process.env.WASABI_BUCKET!,
      Key: fileKey,
      Fields: { acl: 'private' },
      Expires: 300, // 5 minutos
    });

    return {
      ...result
    };
  }

  async createPresignedPut(path: string, fileType: string) {
    const fileKey = `${path}/${randomUUID()}.${fileType.split('/')[1]}`;

    const result = new PutObjectCommand({
      Bucket: process.env.WASABI_BUCKET!,
      Key: fileKey,
    });

    return {
      ...result
    };
  }

  async generateViewUrl(key: string, durationSeconds = 1): Promise<string> {

    const command = new GetObjectCommand({
      Bucket: process.env.WASABI_BUCKET!,
      Key: key,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: durationSeconds * 3600 });
    return url;
  }

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.WASABI_BUCKET!,
      Key: key,
    });

    return this.s3.send(command);
  }
}
