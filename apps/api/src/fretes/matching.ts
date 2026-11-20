import type { Disponibilidade, Frete, Transportador, Veiculo } from '@fortex/db';
import { distanciaKm } from './geo';

/** Raio máximo entre o motorista e a origem da carga. */
export const RAIO_COLETA_KM = 200;
/** Destino pretendido a até esta distância do destino da carga conta como retorno. */
export const RAIO_RETORNO_KM = 100;
/** Posição mais antiga que isso não é usada (o motorista pode ter rodado). */
export const VALIDADE_POSICAO_MS = 12 * 60 * 60 * 1000;

export interface CandidatoBruto {
  transportador: Transportador;
  veiculos: Veiculo[];
  disponibilidade: Disponibilidade | null;
  /** Já tem frete aceito, em coleta ou em trânsito. */
  ocupado: boolean;
}

export type FreteParaMatching = Pick<
  Frete,
  'origemLat' | 'origemLng' | 'destinoLat' | 'destinoLng' | 'eixos' | 'carroceria' | 'coletaFim'
>;

export interface Candidato {
  transportadorId: string;
  veiculoId: string;
  kmAteOrigem: number;
  /** O destino da carga leva o motorista para onde ele quer ir. */
  retorno: boolean;
}

/** Veículo do motorista que atende à carga: ativo, mesmos eixos e carroceria. */
export function veiculoCompativel(frete: Pick<Frete, 'eixos' | 'carroceria'>, veiculos: Veiculo[]): Veiculo | null {
  return veiculos.find((v) => v.ativo && v.eixos === frete.eixos && v.carroceria === frete.carroceria) ?? null;
}

/**
 * Filtra e ordena os motoristas para um frete (estudo v0.3, seção 13).
 * Filtros: cadastro aprovado, livre, disponível, posição recente, perto da
 * origem e veículo compatível. Ordem: quem está voltando para o destino da
 * carga primeiro (menos retorno vazio), depois o mais perto da origem.
 */
export function candidatosParaFrete(frete: FreteParaMatching, brutos: CandidatoBruto[], agora: Date): Candidato[] {
  if (frete.coletaFim <= agora) return [];
  const origem = { lat: frete.origemLat, lng: frete.origemLng };
  const destino = { lat: frete.destinoLat, lng: frete.destinoLng };
  const resultado: Candidato[] = [];

  for (const c of brutos) {
    const d = c.disponibilidade;
    if (c.transportador.statusVerificacao !== 'APROVADO' || c.ocupado || !d?.disponivel) continue;
    if (agora.getTime() - d.atualizadoEm.getTime() > VALIDADE_POSICAO_MS) continue;
    const veiculo = veiculoCompativel(frete, c.veiculos);
    if (!veiculo) continue;
    const kmAteOrigem = distanciaKm({ lat: d.lat, lng: d.lng }, origem);
    if (kmAteOrigem > RAIO_COLETA_KM) continue;
    const retorno =
      d.destinoLat != null && d.destinoLng != null && distanciaKm({ lat: d.destinoLat, lng: d.destinoLng }, destino) <= RAIO_RETORNO_KM;
    resultado.push({ transportadorId: c.transportador.id, veiculoId: veiculo.id, kmAteOrigem: Math.round(kmAteOrigem), retorno });
  }

  return resultado.sort((a, b) => Number(b.retorno) - Number(a.retorno) || a.kmAteOrigem - b.kmAteOrigem);
}
