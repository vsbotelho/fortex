import { Centavos } from './types';

export interface AjustesPreco {
  /** Multiplicador por demanda no corredor. 1 = neutro. */
  demanda?: number;
  /** Multiplicador por urgência da coleta. 1 = neutro. */
  urgencia?: number;
  /** Multiplicador quando a carga é retorno para a base do motorista. 1 = neutro. */
  retorno?: number;
}

export interface EntradaPreco {
  piso: Centavos;
  /** Preço de referência do corredor, se houver histórico. */
  referenciaCorredor?: Centavos;
  ajustes?: AjustesPreco;
}

export interface ResultadoPreco {
  /** Preço sugerido do frete, nunca abaixo do piso. */
  sugerido: Centavos;
  piso: Centavos;
  /** Verdadeiro quando o piso prevaleceu sobre a referência ajustada. */
  limitadoPeloPiso: boolean;
}

function fator(valor: number | undefined, nome: string): number {
  if (valor === undefined) return 1;
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(`Ajuste "${nome}" inválido: ${valor}`);
  }
  return valor;
}

/**
 * Preço do frete = maior valor entre o piso ANTT e a referência do corredor
 * ajustada por demanda, urgência e retorno (estudo v0.3, seção 5).
 */
export function calcularPrecoSugerido(entrada: EntradaPreco): ResultadoPreco {
  const { piso, referenciaCorredor, ajustes = {} } = entrada;
  if (!Number.isInteger(piso) || piso <= 0) {
    throw new RangeError('O piso deve ser um valor positivo em centavos.');
  }

  if (referenciaCorredor === undefined) {
    return { sugerido: piso, piso, limitadoPeloPiso: true };
  }

  const ajustado = Math.round(
    referenciaCorredor *
      fator(ajustes.demanda, 'demanda') *
      fator(ajustes.urgencia, 'urgencia') *
      fator(ajustes.retorno, 'retorno'),
  );

  return ajustado >= piso
    ? { sugerido: ajustado, piso, limitadoPeloPiso: false }
    : { sugerido: piso, piso, limitadoPeloPiso: true };
}

export type ValidacaoFrete =
  | { ok: true }
  | { ok: false; codigo: 'ABAIXO_DO_PISO'; piso: Centavos; diferenca: Centavos };

/**
 * Bloqueio legal: a Lei 15.485/2026 pune a plataforma que anuncia, oferta ou
 * intermedeia frete abaixo do piso. Todo frete publicado passa por aqui.
 */
export function validarFrete(frete: Centavos, piso: Centavos): ValidacaoFrete {
  if (frete >= piso) return { ok: true };
  return { ok: false, codigo: 'ABAIXO_DO_PISO', piso, diferenca: piso - frete };
}
