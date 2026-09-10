// upload.service.ts
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';

/** Dados que o cliente usa para enviar o arquivo direto ao storage. */
export type PresignedUpload = {
  url: string;
  key: string;
  method: 'PUT';
  headers: Record<string, string>;
  fields: Record<string, string>;
};

@Injectable()
export class StorageService {
  private s3 = new S3Client({
    region: process.env.STORAGE_REGION!,
    endpoint: process.env.STORAGE_ENDPOINT!,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET_KEY!,
    },
  });

  async createPresignedPost(path: string, contentType?: string): Promise<PresignedUpload> {
    const fileKey = `${path}`;

    // O Backblaze B2 não implementa o POST-policy do S3 (responde
    // NotImplemented), então o upload assinado é feito por PUT: o cliente envia
    // o arquivo cru no corpo, com o Content-Type declarado aqui.
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET!,
        Key: fileKey,
        ...(contentType && { ContentType: contentType }),
      }),
      { expiresIn: 300 }, // 5 minutos
    );

    return {
      url,
      key: fileKey,
      method: 'PUT' as const,
      headers: contentType ? { 'Content-Type': contentType } : {},
      // Mantido por compatibilidade com quem esperava o formato de POST.
      fields: {},
    };
  }

  /**
   * URL pública e permanente do objeto (endpoint S3-compatible do bucket).
   *
   * Substitui a URL assinada nos caminhos de exibição: o bucket é público, então
   * não há o que assinar nem validade para expirar. É também a URL entregue ao
   * provider de WhatsApp no envio de mídia.
   */
  getPublicUrl(key: string): string {
    if (!key) return '';

    const encodedKey = key.split('/').map(encodeURIComponent).join('/');

    // Quando há um CDN na frente do bucket (STORAGE_PUBLIC_URL), servir por ele:
    // o bucket fica em eu-central e a latência daqui passa de 200ms, o que
    // aproxima o download do limite de tolerância do provider ao buscar mídia.
    const cdn = process.env.STORAGE_PUBLIC_URL?.replace(/\/+$/, '');
    if (cdn) {
      return `${cdn}/${encodedKey}`;
    }

    const endpoint = process.env.STORAGE_ENDPOINT!.replace(/\/+$/, '');
    const bucket = process.env.STORAGE_BUCKET!;

    return `${endpoint}/${bucket}/${encodedKey}`;
  }

  /**
   * URL assinada. Mantida apenas para downloads forçados (Content-Disposition
   * attachment), que a URL pública não oferece.
   */
  async generateViewUrl(key: string, durationHours = 1, asAttachment = true): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.STORAGE_BUCKET!,
      Key: key,
      ...(asAttachment && {
        ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"`,
      }),
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: durationHours * 3600 });
    return url;
  }

  async deleteObject(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.STORAGE_BUCKET!,
      Key: key,
    });

    return this.s3.send(command);
  }

  async uploadFileBase64(base64Data: string, key: string, fileType: string) {
    const buffer = Buffer.from(base64Data, 'base64');
    return await this.uploadBuffer(buffer, key, fileType);
  }

  async uploadBuffer(buffer: Buffer, key: string, mimetype: string) {
    const bucket = process.env.STORAGE_BUCKET!;

    const uploadResult = await this.s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    return uploadResult;
  }
}
