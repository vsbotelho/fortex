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

  it('cota com a tabela vigente', () => {
    const r = new CotacaoService(TABELA_VIGENTE).cotar(base);
    expect(r.piso.valor).toBe(361_240);
  });

  it('fica indisponível para tipo de carga sem coeficiente carregado', () => {
    expect(() => new CotacaoService(TABELA_VIGENTE).cotar({ ...base, tipoCarga: TipoCarga.CARGA_GERAL })).toThrow(
      ServiceUnavailableException,
    );
  });
});
