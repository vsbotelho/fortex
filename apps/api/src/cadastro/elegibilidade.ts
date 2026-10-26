import type { Transportador, Veiculo } from '@fortex/db';

export interface Elegibilidade {
  /** Pode receber ofertas de frete. */
  apto: boolean;
  pendencias: string[];
}

const MENSAGEM_STATUS: Record<Transportador['statusVerificacao'], string | null> = {
  PENDENTE: 'Cadastro aguardando verificação de documentos (RNTRC, CNH e identidade).',
  EM_ANALISE: 'Cadastro em análise.',
  APROVADO: null,
  REPROVADO: 'Cadastro reprovado.',
};

/**
 * Primeiro filtro do matching (estudo v0.3, seção 13): só transportador
 * regular, com cadastro aprovado e veículo ativo, recebe oferta.
 */
export function avaliarElegibilidade(t: Transportador, veiculos: Veiculo[]): Elegibilidade {
  const pendencias: string[] = [];
  const status = MENSAGEM_STATUS[t.statusVerificacao];
  if (status) {
    pendencias.push(t.statusVerificacao === 'REPROVADO' && t.motivoReprovacao ? `${status} Motivo: ${t.motivoReprovacao}` : status);
  }
  if (!veiculos.some((v) => v.ativo)) {
    pendencias.push('Cadastre ao menos um veículo ativo.');
  }
  return { apto: pendencias.length === 0, pendencias };
}
