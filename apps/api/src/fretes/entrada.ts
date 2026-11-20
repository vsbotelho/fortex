import { Erros, texto } from '../cadastro/entrada';
import { ADIANTAMENTO_PADRAO_PERCENTUAL } from '../cotacao/cotacao.service';
import { noBrasil, Ponto } from './geo';

export interface Local extends Ponto {
  nome: string;
}

export interface DadosFrete {
  origem: Local;
  destino: Local;
  distanciaKm: number;
  tipoCarga: 'GRANEL_SOLIDO';
  produto: string;
  pesoKg: number;
  eixos: number;
  carroceria: 'GRANELEIRO' | 'BASCULANTE';
  coletaInicio: Date;
  coletaFim: Date;
  valePedagioCentavos: number;
  /** Ausente: usa o preço sugerido. */
  freteCentavos?: number;
  adiantamentoPercentual: number;
  observacoes: string | null;
}

const EIXOS = [2, 3, 4, 5, 6, 7, 9];
const CARROCERIAS = ['GRANELEIRO', 'BASCULANTE'];
const PESO_MAX_KG = 74_000; // PBTC máximo de um rodotrem

function numero(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function local(body: Record<string, unknown>, campo: string, erros: Erros): Local | undefined {
  const v = body?.[campo] as Record<string, unknown> | undefined;
  if (!v || typeof v !== 'object') {
    erros.add(campo, 'Informe nome, lat e lng.');
    return undefined;
  }
  const nome = texto(v, 'nome', new Erros());
  const lat = numero(v.lat);
  const lng = numero(v.lng);
  if (!nome || lat === undefined || lng === undefined) {
    erros.add(campo, 'Informe nome, lat e lng.');
    return undefined;
  }
  if (!noBrasil({ lat, lng })) {
    erros.add(campo, 'Coordenadas fora do Brasil.');
    return undefined;
  }
  return { nome, lat, lng };
}

function data(body: Record<string, unknown>, campo: string, erros: Erros): Date | undefined {
  const v = body?.[campo];
  const d = typeof v === 'string' ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) {
    erros.add(campo, 'Data e hora em ISO 8601 (ex.: 2026-11-21T07:00:00-03:00).');
    return undefined;
  }
  return d;
}

function centavos(body: Record<string, unknown>, campo: string, erros: Erros, opcional: boolean): number | undefined {
  const v = body?.[campo];
  if (v === undefined || v === null) {
    if (!opcional) erros.add(campo, 'Obrigatório.');
    return undefined;
  }
  if (!Number.isInteger(v) || (v as number) < 0) {
    erros.add(campo, 'Valor em centavos (inteiro, sem vírgula).');
    return undefined;
  }
  return v as number;
}

export function lerFrete(body: Record<string, unknown>, agora: Date): DadosFrete {
  const erros = new Erros();
  const origem = local(body, 'origem', erros);
  const destino = local(body, 'destino', erros);

  const distanciaKm = numero(body?.distanciaKm);
  if (distanciaKm === undefined || distanciaKm <= 0 || distanciaKm > 5000) erros.add('distanciaKm', 'Entre 1 e 5.000 km.');

  const tipoCarga = body?.tipoCarga ?? 'GRANEL_SOLIDO';
  if (tipoCarga !== 'GRANEL_SOLIDO') erros.add('tipoCarga', 'No MVP, só granel sólido (grãos).');

  const produto = texto(body, 'produto', erros);
  const pesoKg = numero(body?.pesoKg);
  if (pesoKg === undefined || !Number.isInteger(pesoKg) || pesoKg <= 0 || pesoKg > PESO_MAX_KG) {
    erros.add('pesoKg', `Peso em kg, inteiro, até ${PESO_MAX_KG.toLocaleString('pt-BR')}.`);
  }
  const eixos = body?.eixos;
  if (typeof eixos !== 'number' || !EIXOS.includes(eixos)) erros.add('eixos', 'Use 2, 3, 4, 5, 6, 7 ou 9 eixos.');
  const carroceria = body?.carroceria;
  if (!CARROCERIAS.includes(carroceria as string)) erros.add('carroceria', 'No MVP de grãos: GRANELEIRO ou BASCULANTE.');

  const coletaInicio = data(body, 'coletaInicio', erros);
  const coletaFim = data(body, 'coletaFim', erros);
  if (coletaInicio && coletaFim) {
    if (coletaFim <= coletaInicio) erros.add('coletaFim', 'Deve ser depois do início da coleta.');
    else if (coletaFim <= agora) erros.add('coletaFim', 'A janela de coleta já passou.');
  }

  const valePedagioCentavos = centavos(body, 'valePedagio', erros, false);
  const freteCentavos = centavos(body, 'frete', erros, true);

  let adiantamentoPercentual = ADIANTAMENTO_PADRAO_PERCENTUAL;
  if (body?.adiantamentoPercentual !== undefined) {
    const a = body.adiantamentoPercentual;
    if (!Number.isInteger(a) || (a as number) < 0 || (a as number) > 100) erros.add('adiantamentoPercentual', 'Inteiro de 0 a 100.');
    else adiantamentoPercentual = a as number;
  }

  const observacoes = texto(body, 'observacoes', erros, true) ?? null;
  erros.lancarSeHouver();

  return {
    origem: origem!,
    destino: destino!,
    distanciaKm: Math.round(distanciaKm! * 10) / 10,
    tipoCarga: 'GRANEL_SOLIDO',
    produto: produto!,
    pesoKg: pesoKg!,
    eixos: eixos as number,
    carroceria: carroceria as DadosFrete['carroceria'],
    coletaInicio: coletaInicio!,
    coletaFim: coletaFim!,
    valePedagioCentavos: valePedagioCentavos!,
    freteCentavos,
    adiantamentoPercentual,
    observacoes,
  };
}
