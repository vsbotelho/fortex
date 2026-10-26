export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const ENVIADOR_CODIGO = Symbol('ENVIADOR_CODIGO');
export const RELOGIO = Symbol('RELOGIO');

export interface AuthConfig {
  /** Segredo do HMAC dos códigos. Obrigatório em produção. */
  segredo: string;
  validadeCodigoMs: number;
  maxTentativasPorCodigo: number;
  /** Quantos códigos um telefone pode pedir dentro da janela. */
  maxCodigosPorJanela: number;
  janelaCodigosMs: number;
  validadeSessaoMs: number;
}

export type Relogio = () => Date;

export interface EnviadorCodigo {
  enviar(telefone: string, codigo: string): Promise<void>;
}

const MIN = 60_000;

export function configDoAmbiente(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const producao = env.NODE_ENV === 'production';
  const segredo = env.AUTH_SECRET;
  if (producao && (!segredo || segredo.length < 32)) {
    throw new Error('AUTH_SECRET obrigatório em produção (mínimo de 32 caracteres).');
  }
  return {
    segredo: segredo ?? 'segredo-apenas-para-desenvolvimento-local',
    validadeCodigoMs: 10 * MIN,
    maxTentativasPorCodigo: 5,
    maxCodigosPorJanela: 3,
    janelaCodigosMs: 15 * MIN,
    validadeSessaoMs: 30 * 24 * 60 * MIN,
  };
}

/**
 * Envio pelo console, só para desenvolvimento. Em produção a API não sobe sem
 * um provedor real de SMS/WhatsApp (PENDENTE: escolher o provedor).
 */
export class EnviadorConsole implements EnviadorCodigo {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Configure um provedor de SMS/WhatsApp para enviar códigos em produção.');
    }
  }

  async enviar(telefone: string, codigo: string) {
    console.log(`[dev] Código de acesso para ${telefone}: ${codigo}`);
  }
}
