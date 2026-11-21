import { fotoVencida } from './foto-whatsapp';

describe('fotoVencida', () => {
  const agora = Date.parse('2026-11-20T12:00:00Z');
  const url = (quando: string) => `https://pps.whatsapp.net/v/t61/x.jpg?ccb=11-4&oh=abc&oe=${Math.floor(Date.parse(quando) / 1000).toString(16).toUpperCase()}&_nc_sid=5e03e0`;

  it('vencida, ou vencendo nas próximas 6 h, conta como vencida', () => {
    expect(fotoVencida(url('2026-10-10T22:27:58Z'), agora)).toBe(true);
    expect(fotoVencida(url('2026-11-20T15:00:00Z'), agora)).toBe(true);
    expect(fotoVencida(url('2026-11-25T12:00:00Z'), agora)).toBe(false);
  });

  it('sem validade na URL (foto nossa no bucket) ou vazia: não vencida', () => {
    expect(fotoVencida('contacts/avatar/1.jpg', agora)).toBe(false);
    expect(fotoVencida(null, agora)).toBe(false);
  });
});
