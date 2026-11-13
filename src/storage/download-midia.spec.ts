import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn().mockResolvedValue('https://storage/assinada') }));

describe('Assinatura de download', () => {
  it('usa attachment, nome UTF-8 seguro e validade curta', async () => {
    await new StorageService().generateViewUrl('chat/objeto.png', 5 / 60, true, 'Foto "técnica"\r\n.png');
    const [, comando, opcoes] = (getSignedUrl as jest.Mock).mock.calls.at(-1);
    expect(comando.input.Key).toBe('chat/objeto.png');
    expect(comando.input.ResponseContentDisposition).toContain('attachment; filename=');
    expect(comando.input.ResponseContentDisposition).toContain("filename*=UTF-8''Foto%20%22t%C3%A9cnica%22.png");
    expect(comando.input.ResponseContentDisposition).not.toMatch(/[\r\n]/);
    expect(opcoes.expiresIn).toBe(300);
  });
});
