import { Centavos } from './types';
import { validarFrete } from './preco';

export type TaxaFortex =
  | { tipo: 'percentual'; percentual: number }
  | { tipo: 'fixa'; valor: Centavos };

export interface EntradaCotacao {
  frete: Centavos;
  piso: Centavos;
  valePedagio: Centavos;
  taxa: TaxaFortex;
  /** Percentual do frete pago na coleta (0 a 100). A lei não fixa mínimo. */
  adiantamentoPercentual: number;
}

export interface Cotacao {
  /** Valor integral do frete, pago 100% ao transportador. */
  freteTransportador: Centavos;
  adiantamentoColeta: Centavos;
  saldoEntrega: Centavos;
  /** Antecipado pelo embarcador, fora do frete (Lei 10.209/2001). */
  valePedagio: Centavos;
  /** Valor que o embarcador aporta na IPEF: frete + Vale-Pedágio. */
  aporteIpef: Centavos;
  /** Taxa do Fortex, cobrada do embarcador com nota fiscal própria. Não sai do frete. */
  taxaFortex: Centavos;
}

export class FreteAbaixoDoPisoError extends Error {
  constructor(public readonly frete: Centavos, public readonly piso: Centavos) {
    super('Frete abaixo do piso mínimo ANTT. Publicação bloqueada.');
    this.name = 'FreteAbaixoDoPisoError';
  }
}

/**
 * Monta a cotação com os três valores separados (frete, Vale-Pedágio e taxa).
 * Regras: frete no piso ou acima; nenhum desconto sobre o frete do
 * transportador (Lei 11.442, art. 13-B); taxa faturada ao embarcador.
 */
export function montarCotacao(e: EntradaCotacao): Cotacao {
  const validacao = validarFrete(e.frete, e.piso);
  if (!validacao.ok) {
    throw new FreteAbaixoDoPisoError(e.frete, e.piso);
  }
  if (e.adiantamentoPercentual < 0 || e.adiantamentoPercentual > 100) {
    throw new RangeError('Adiantamento deve ficar entre 0 e 100%.');
  }
  if (!Number.isInteger(e.valePedagio) || e.valePedagio < 0) {
    throw new RangeError('Vale-Pedágio inválido.');
  }

  const adiantamentoColeta = Math.round((e.frete * e.adiantamentoPercentual) / 100);
  const saldoEntrega = e.frete - adiantamentoColeta;

  let taxaFortex: Centavos;
  if (e.taxa.tipo === 'percentual') {
    if (e.taxa.percentual < 0) throw new RangeError('Percentual da taxa inválido.');
    taxaFortex = Math.round((e.frete * e.taxa.percentual) / 100);
  } else {
    if (!Number.isInteger(e.taxa.valor) || e.taxa.valor < 0) {
      throw new RangeError('Valor da taxa inválido.');
    }
    taxaFortex = e.taxa.valor;
  }

  return {
    freteTransportador: e.frete,
    adiantamentoColeta,
    saldoEntrega,
    valePedagio: e.valePedagio,
    aporteIpef: e.frete + e.valePedagio,
    taxaFortex,
  };
}
