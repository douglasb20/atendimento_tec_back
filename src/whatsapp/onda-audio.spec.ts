import { decodificarOnda } from './onda-audio';

describe('decodificarOnda', () => {
  it('base64 (gateway) vira as alturas', () => {
    expect(decodificarOnda(Buffer.from([0, 50, 100]).toString('base64'))).toEqual([0, 50, 100]);
  });

  it('aceita os formatos que o JSON de bytes pode ter', () => {
    expect(decodificarOnda([1, 2])).toEqual([1, 2]);
    expect(decodificarOnda({ type: 'Buffer', data: [3, 4] })).toEqual([3, 4]);
    expect(decodificarOnda({ 0: 5, 1: 6 })).toEqual([5, 6]);
  });

  it('valores fora de 0 a 100 são limitados', () => {
    expect(decodificarOnda([120, -3])).toEqual([100, 0]);
  });

  it('ausente, vazia ou inválida devolve null', () => {
    expect(decodificarOnda(undefined)).toBeNull();
    expect(decodificarOnda('')).toBeNull();
    expect(decodificarOnda([])).toBeNull();
    expect(decodificarOnda('não é base64 ###')).toBeNull();
  });
});
