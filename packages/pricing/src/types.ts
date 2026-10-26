/**
 * Valores monetários são sempre inteiros em centavos, para evitar erro de
 * arredondamento de ponto flutuante.
 */
export type Centavos = number;

/** Tipos de carga da tabela de piso mínimo da ANTT. O MVP usa só GRANEL_SOLIDO. */
export enum TipoCarga {
  GRANEL_SOLIDO = 'GRANEL_SOLIDO',
  GRANEL_LIQUIDO = 'GRANEL_LIQUIDO',
  FRIGORIFICADA = 'FRIGORIFICADA',
  CONTEINERIZADA = 'CONTEINERIZADA',
  CARGA_GERAL = 'CARGA_GERAL',
  NEOGRANEL = 'NEOGRANEL',
  GRANEL_PRESSURIZADA = 'GRANEL_PRESSURIZADA',
}

/** Uma linha da tabela de coeficientes da ANTT. */
export interface CoeficientePiso {
  tipoCarga: TipoCarga;
  eixos: number;
  /** Coeficiente de custo de deslocamento (CCD), em centavos por km. */
  ccdCentavosPorKm: number;
  /** Coeficiente de custo de carga e descarga (CC), em centavos. */
  ccCentavos: Centavos;
}

/** Tabela de coeficientes vigente, com a norma de origem. */
export interface TabelaPiso {
  /** Ex.: "Resolução ANTT 6.084/2026". */
  norma: string;
  /** Início de vigência, ISO 8601 (AAAA-MM-DD). */
  vigenciaInicio: string;
  coeficientes: CoeficientePiso[];
}

export interface EntradaPiso {
  tipoCarga: TipoCarga;
  eixos: number;
  distanciaKm: number;
}

export interface ResultadoPiso {
  valor: Centavos;
  ccdCentavosPorKm: number;
  ccCentavos: Centavos;
  distanciaKm: number;
  norma: string;
  vigenciaInicio: string;
}
