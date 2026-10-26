import { TabelaPiso } from './types';

/**
 * Tabela de coeficientes da Resolução ANTT 6.084/2026.
 *
 * PENDENTE: preencher com os valores oficiais do anexo da resolução
 * (CCD em centavos/km e CC em centavos, por tipo de carga e número de eixos).
 * Não usar valores estimados: o piso tem efeito legal.
 *
 * Enquanto vazia, calcularPiso() lança CoeficienteNaoEncontradoError, e a
 * publicação de frete fica bloqueada.
 */
export const TABELA_VIGENTE: TabelaPiso = {
  norma: 'Resolução ANTT 6.084/2026',
  vigenciaInicio: '2026-01-01', // PENDENTE: confirmar a data de vigência
  coeficientes: [],
};
