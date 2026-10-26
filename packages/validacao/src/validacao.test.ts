import { describe, expect, it } from 'vitest';
import {
  normalizarCnh,
  normalizarCnpj,
  normalizarCpf,
  normalizarPlaca,
  normalizarRenavam,
  normalizarRntrc,
} from './index';

describe('CPF', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(normalizarCpf('529.982.247-25')).toBe('52998224725');
    expect(normalizarCpf('52998224725')).toBe('52998224725');
  });
  it('rejeita DV errado, tamanho errado e sequência repetida', () => {
    expect(normalizarCpf('529.982.247-24')).toBeNull();
    expect(normalizarCpf('5299822472')).toBeNull();
    expect(normalizarCpf('111.111.111-11')).toBeNull();
  });
});

describe('CNPJ', () => {
  it('aceita CNPJ numérico válido', () => {
    expect(normalizarCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
  it('aceita CNPJ alfanumérico (exemplo da Receita Federal)', () => {
    expect(normalizarCnpj('12.ABC.345/01DE-35')).toBe('12ABC34501DE35');
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
  it('rejeita DV errado, letra no DV e sequência repetida', () => {
    expect(normalizarCnpj('11.222.333/0001-82')).toBeNull();
    expect(normalizarCnpj('12.ABC.345/01DE-3A')).toBeNull();
    expect(normalizarCnpj('00.000.000/0000-00')).toBeNull();
  });
});

describe('CNH', () => {
  it('aceita 11 dígitos', () => {
    expect(normalizarCnh('0123456789-0')).toBe('01234567890');
  });
  it('rejeita tamanho errado e sequência repetida', () => {
    expect(normalizarCnh('123')).toBeNull();
    expect(normalizarCnh('22222222222')).toBeNull();
  });
});

describe('RENAVAM', () => {
  it('aceita RENAVAM válido e completa com zeros', () => {
    expect(normalizarRenavam('00639884962')).toBe('00639884962');
    expect(normalizarRenavam('639884962')).toBe('00639884962');
  });
  it('rejeita DV errado', () => {
    expect(normalizarRenavam('00639884963')).toBeNull();
  });
});

describe('Placa', () => {
  it('aceita padrão antigo e Mercosul', () => {
    expect(normalizarPlaca('abc-1234')).toBe('ABC1234');
    expect(normalizarPlaca('BRA2E19')).toBe('BRA2E19');
  });
  it('rejeita formatos inválidos', () => {
    expect(normalizarPlaca('AB12345')).toBeNull();
    expect(normalizarPlaca('ABC12E4')).toBeNull();
  });
});

describe('RNTRC', () => {
  it('aceita 8 ou 9 dígitos e guarda com 9', () => {
    expect(normalizarRntrc('12345678')).toBe('012345678');
    expect(normalizarRntrc('012345678')).toBe('012345678');
  });
  it('rejeita tamanho errado', () => {
    expect(normalizarRntrc('1234567')).toBeNull();
    expect(normalizarRntrc('1234567890')).toBeNull();
  });
});
