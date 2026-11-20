import type { Frete } from '@fortex/db';
import type { Candidato } from './matching';

export const NOTIFICADOR_FRETES = Symbol('NOTIFICADOR_FRETES');

/** Quantos motoristas recebem o aviso de um frete novo, na ordem do matching. */
export const MAX_AVISADOS = 20;

/**
 * Avisos do ciclo do frete. PENDENTE: push no app (Firebase/Expo) e
 * WhatsApp. Hoje só registra no console.
 */
export interface NotificadorFretes {
  novoFrete(frete: Frete, candidatos: Candidato[]): Promise<void>;
  freteAceito(frete: Frete): Promise<void>;
  statusAlterado(frete: Frete, de: Frete['status']): Promise<void>;
}

export class NotificadorConsole implements NotificadorFretes {
  async novoFrete(frete: Frete, candidatos: Candidato[]) {
    console.log(`[aviso] Frete ${frete.id} publicado; ${candidatos.length} motorista(s) avisado(s).`);
  }

  async freteAceito(frete: Frete) {
    console.log(`[aviso] Frete ${frete.id} aceito pelo transportador ${frete.transportadorId}.`);
  }

  async statusAlterado(frete: Frete, de: Frete['status']) {
    console.log(`[aviso] Frete ${frete.id}: ${de} → ${frete.status}.`);
  }
}
