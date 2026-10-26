import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { TabelaPiso, TABELA_VIGENTE, TipoCarga } from '@fortex/pricing';
import { CotacaoService } from './cotacao.service';

// Coeficientes FICTÍCIOS, só para teste.
const tabela: TabelaPiso = {
  norma: 'Tabela de teste',
  vigenciaInicio: '2026-01-01',
  coeficientes: [{ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, ccdCentavosPorKm: 650, ccCentavos: 70_000 }],
};
const base = { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, distanciaKm: 430, valePedagio: 0, adiantamentoPercentual: 40 };

describe('CotacaoService', () => {
  it('cota pelo preço sugerido quando o embarcador não informa frete', () => {
    const r = new CotacaoService(tabela).cotar(base);
    expect(r.cotacao.freteTransportador).toBe(r.piso.valor);
  });

  it('recusa frete abaixo do piso', () => {
    expect(() => new CotacaoService(tabela).cotar({ ...base, frete: 100_000 })).toThrow(UnprocessableEntityException);
  });

  it('fica indisponível enquanto a tabela oficial não for carregada', () => {
    expect(() => new CotacaoService(TABELA_VIGENTE).cotar(base)).toThrow(ServiceUnavailableException);
  });
});
