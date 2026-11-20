import type { PapelUsuario, StatusFrete } from '@fortex/db';

/** Quem age sobre o frete: o embarcador dono, o motorista designado ou um admin. */
export type Ator = 'EMBARCADOR' | 'MOTORISTA' | 'ADMIN';

/**
 * Transições permitidas e quem pode fazer cada uma. O aceite
 * (PUBLICADO → ACEITO) tem rota própria e não passa por aqui.
 */
const TRANSICOES: Partial<Record<StatusFrete, Partial<Record<StatusFrete, Ator[]>>>> = {
  PUBLICADO: { CANCELADO: ['EMBARCADOR', 'ADMIN'] },
  ACEITO: {
    EM_COLETA: ['MOTORISTA'],
    // Motorista desiste antes de chegar: o frete volta para a vitrine.
    PUBLICADO: ['MOTORISTA', 'ADMIN'],
    CANCELADO: ['EMBARCADOR', 'ADMIN'],
  },
  EM_COLETA: {
    EM_TRANSITO: ['MOTORISTA'],
    // Espera excessiva, carga divergente, avaria: qualquer lado cancela com motivo.
    CANCELADO: ['EMBARCADOR', 'MOTORISTA', 'ADMIN'],
  },
  EM_TRANSITO: { ENTREGUE: ['MOTORISTA', 'ADMIN'] },
};

export function podeTransitar(de: StatusFrete, para: StatusFrete, ator: Ator): boolean {
  return TRANSICOES[de]?.[para]?.includes(ator) ?? false;
}

/** Status em que o frete ocupa o motorista. */
export const STATUS_ATIVOS: StatusFrete[] = ['ACEITO', 'EM_COLETA', 'EM_TRANSITO'];

export function atorDoPapel(papel: PapelUsuario): Ator | null {
  return papel === 'NOVO' ? null : papel;
}
