import { EntradaPiso, ResultadoPiso, TabelaPiso } from './types';

export class CoeficienteNaoEncontradoError extends Error {
  constructor(public readonly entrada: Pick<EntradaPiso, 'tipoCarga' | 'eixos'>) {
    super(
      `Sem coeficiente ANTT para ${entrada.tipoCarga} com ${entrada.eixos} eixos. ` +
        'Verifique se a tabela vigente foi carregada.',
    );
    this.name = 'CoeficienteNaoEncontradoError';
  }
}

/**
 * Piso mínimo do frete (Lei 13.703/2018; tabela da Res. ANTT 6.084/2026):
 * piso = distância × CCD + CC.
 *
 * O resultado é arredondado para cima, ao centavo, para nunca ficar abaixo
 * do mínimo legal por arredondamento.
 */
export function calcularPiso(entrada: EntradaPiso, tabela: TabelaPiso): ResultadoPiso {
  if (!Number.isFinite(entrada.distanciaKm) || entrada.distanciaKm <= 0) {
    throw new RangeError('A distância deve ser maior que zero.');
  }
  if (!Number.isInteger(entrada.eixos) || entrada.eixos < 2) {
    throw new RangeError('O número de eixos deve ser um inteiro a partir de 2.');
  }

  const coef = tabela.coeficientes.find(
    (c) => c.tipoCarga === entrada.tipoCarga && c.eixos === entrada.eixos,
  );
  if (!coef) {
    throw new CoeficienteNaoEncontradoError(entrada);
  }

  const valor = Math.ceil(entrada.distanciaKm * coef.ccdCentavosPorKm + coef.ccCentavos);

  return {
    valor,
    ccdCentavosPorKm: coef.ccdCentavosPorKm,
    ccCentavos: coef.ccCentavos,
    distanciaKm: entrada.distanciaKm,
    norma: tabela.norma,
    vigenciaInicio: tabela.vigenciaInicio,
  };
}
