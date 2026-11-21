import { conteudoDaLocalizacao } from './localizacao';

describe('conteudoDaLocalizacao', () => {
  it('coordenadas na primeira linha e o endereço embaixo, sem linha vazia', () => {
    expect(conteudoDaLocalizacao(-17.79, -50.92, null, 'Rua A, 10')).toBe('-17.79,-50.92\nRua A, 10');
  });
});
