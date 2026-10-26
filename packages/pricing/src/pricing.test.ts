import { describe, expect, it } from 'vitest';
import {
  calcularPiso,
  calcularPrecoSugerido,
  CoeficienteNaoEncontradoError,
  FreteAbaixoDoPisoError,
  montarCotacao,
  TABELA_VIGENTE,
  TabelaPiso,
  TipoCarga,
  validarFrete,
} from './index';

// Coeficientes FICTÍCIOS, só para testar a fórmula. Não são valores da ANTT.
const TABELA_TESTE: TabelaPiso = {
  norma: 'Tabela de teste',
  vigenciaInicio: '2026-01-01',
  coeficientes: [
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, ccdCentavosPorKm: 650, ccCentavos: 70_000 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 6, ccdCentavosPorKm: 733.5, ccCentavos: 75_000 },
  ],
};

describe('calcularPiso', () => {
  it('aplica distância × CCD + CC', () => {
    const r = calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, distanciaKm: 430 }, TABELA_TESTE);
    expect(r.valor).toBe(430 * 650 + 70_000);
    expect(r.norma).toBe('Tabela de teste');
  });

  it('arredonda para cima ao centavo', () => {
    const r = calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 6, distanciaKm: 101 }, TABELA_TESTE);
    expect(r.valor).toBe(Math.ceil(101 * 733.5 + 75_000));
    expect(Number.isInteger(r.valor)).toBe(true);
  });

  it('falha quando não há coeficiente', () => {
    expect(() =>
      calcularPiso({ tipoCarga: TipoCarga.CARGA_GERAL, eixos: 5, distanciaKm: 100 }, TABELA_TESTE),
    ).toThrow(CoeficienteNaoEncontradoError);
  });

  it('tabela vigente: granel sólido, 5 eixos, 430 km = 430 × R$ 6,8548 + R$ 664,83', () => {
    const r = calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, distanciaKm: 430 }, TABELA_VIGENTE);
    expect(r.valor).toBe(361_240); // R$ 3.612,394 arredondado para cima: R$ 3.612,40
  });

  it('tabela vigente: granel sólido, 9 eixos, 1.000 km', () => {
    const r = calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 9, distanciaKm: 1000 }, TABELA_VIGENTE);
    expect(r.valor).toBe(943_180 + 90_891);
  });

  it('tabela vigente: não existe coeficiente para 8 eixos nem para outros tipos de carga', () => {
    expect(() =>
      calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 8, distanciaKm: 100 }, TABELA_VIGENTE),
    ).toThrow(CoeficienteNaoEncontradoError);
    expect(() =>
      calcularPiso({ tipoCarga: TipoCarga.CARGA_GERAL, eixos: 5, distanciaKm: 100 }, TABELA_VIGENTE),
    ).toThrow(CoeficienteNaoEncontradoError);
  });

  it('tabela vigente: toda linha tem coeficientes positivos e sem duplicidade', () => {
    const chaves = new Set<string>();
    for (const c of TABELA_VIGENTE.coeficientes) {
      expect(c.ccdCentavosPorKm).toBeGreaterThan(0);
      expect(Number.isInteger(c.ccCentavos) && c.ccCentavos > 0).toBe(true);
      const chave = `${c.tipoCarga}-${c.eixos}`;
      expect(chaves.has(chave)).toBe(false);
      chaves.add(chave);
    }
  });

  it('rejeita distância e eixos inválidos', () => {
    expect(() => calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, distanciaKm: 0 }, TABELA_TESTE)).toThrow(RangeError);
    expect(() => calcularPiso({ tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 1, distanciaKm: 10 }, TABELA_TESTE)).toThrow(RangeError);
  });
});

describe('calcularPrecoSugerido', () => {
  it('usa o piso quando não há referência', () => {
    expect(calcularPrecoSugerido({ piso: 300_000 })).toEqual({ sugerido: 300_000, piso: 300_000, limitadoPeloPiso: true });
  });

  it('usa a referência ajustada quando fica acima do piso', () => {
    const r = calcularPrecoSugerido({ piso: 300_000, referenciaCorredor: 320_000, ajustes: { demanda: 1.1 } });
    expect(r).toEqual({ sugerido: 352_000, piso: 300_000, limitadoPeloPiso: false });
  });

  it('nunca fica abaixo do piso', () => {
    const r = calcularPrecoSugerido({ piso: 300_000, referenciaCorredor: 320_000, ajustes: { retorno: 0.8 } });
    expect(r.sugerido).toBe(300_000);
    expect(r.limitadoPeloPiso).toBe(true);
  });
});

describe('validarFrete', () => {
  it('aceita no piso e acima', () => {
    expect(validarFrete(300_000, 300_000)).toEqual({ ok: true });
    expect(validarFrete(300_001, 300_000)).toEqual({ ok: true });
  });

  it('bloqueia abaixo do piso', () => {
    expect(validarFrete(299_999, 300_000)).toEqual({ ok: false, codigo: 'ABAIXO_DO_PISO', piso: 300_000, diferenca: 1 });
  });
});

describe('montarCotacao', () => {
  it('reproduz o exemplo do estudo: frete de R$ 10.000, taxa de 8%, 40% na coleta', () => {
    const c = montarCotacao({
      frete: 1_000_000,
      piso: 900_000,
      valePedagio: 25_000,
      taxa: { tipo: 'percentual', percentual: 8 },
      adiantamentoPercentual: 40,
    });
    expect(c).toEqual({
      freteTransportador: 1_000_000,
      adiantamentoColeta: 400_000,
      saldoEntrega: 600_000,
      valePedagio: 25_000,
      aporteIpef: 1_025_000,
      taxaFortex: 80_000,
    });
  });

  it('o transportador sempre recebe 100% do frete', () => {
    const c = montarCotacao({ frete: 333_333, piso: 300_000, valePedagio: 0, taxa: { tipo: 'fixa', valor: 15_000 }, adiantamentoPercentual: 33 });
    expect(c.adiantamentoColeta + c.saldoEntrega).toBe(333_333);
    expect(c.freteTransportador).toBe(333_333);
  });

  it('bloqueia cotação abaixo do piso', () => {
    expect(() =>
      montarCotacao({ frete: 150_000, piso: 399_300, valePedagio: 0, taxa: { tipo: 'percentual', percentual: 8 }, adiantamentoPercentual: 40 }),
    ).toThrow(FreteAbaixoDoPisoError);
  });
});
