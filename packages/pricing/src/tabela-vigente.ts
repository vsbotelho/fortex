import { TabelaPiso, TipoCarga } from './types';

/**
 * Coeficientes do piso mínimo vigentes: Resolução ANTT 6.084/2026, com
 * Anexo II reajustado pela Portaria SUROC nº 22, de 28/09/2026
 * (DOU de 29/09/2026; em vigor a partir de 30/09/2026).
 * Diesel S10 de referência: R$ 7,33/L.
 *
 * Carregado: Tabela A (lotação), granel sólido — único tipo do MVP.
 * Transcrito da LegisWeb (legisweb.com.br/legislacao/?id=502245).
 * PENDENTE: conferir contra o DOU / ANTTlegis antes do lançamento.
 *
 * Unidades: CCD em centavos por km; CC em centavos.
 * Não há coeficiente para 8 eixos na tabela da ANTT.
 */
export const TABELA_VIGENTE: TabelaPiso = {
  norma: 'Res. ANTT 6.084/2026, Anexo II reajustado pela Portaria SUROC 22/2026',
  vigenciaInicio: '2026-09-30',
  coeficientes: [
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 2, ccdCentavosPorKm: 410.56, ccCentavos: 46_059 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 3, ccdCentavosPorKm: 525.55, ccCentavos: 55_224 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 4, ccdCentavosPorKm: 594.76, ccCentavos: 59_700 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 5, ccdCentavosPorKm: 685.48, ccCentavos: 66_483 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 6, ccdCentavosPorKm: 756.41, ccCentavos: 68_001 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 7, ccdCentavosPorKm: 823.16, ccCentavos: 82_034 },
    { tipoCarga: TipoCarga.GRANEL_SOLIDO, eixos: 9, ccdCentavosPorKm: 943.18, ccCentavos: 90_891 },
  ],
};
