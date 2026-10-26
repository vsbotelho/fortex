import { BadRequestException } from '@nestjs/common';

/** Coleta todos os erros de validação e devolve de uma vez. */
export class Erros {
  private readonly itens: Record<string, string> = {};

  add(campo: string, mensagem: string) {
    this.itens[campo] = mensagem;
  }

  lancarSeHouver() {
    if (Object.keys(this.itens).length > 0) {
      throw new BadRequestException({ codigo: 'DADOS_INVALIDOS', campos: this.itens });
    }
  }
}

export function texto(body: Record<string, unknown>, campo: string, erros: Erros, opcional = false): string | undefined {
  const v = body?.[campo];
  if (v === undefined || v === null || v === '') {
    if (!opcional) erros.add(campo, 'Obrigatório.');
    return undefined;
  }
  if (typeof v !== 'string') {
    erros.add(campo, 'Deve ser texto.');
    return undefined;
  }
  const t = v.trim();
  if (t.length > 200) {
    erros.add(campo, 'Máximo de 200 caracteres.');
    return undefined;
  }
  return t;
}

export function documento(
  body: Record<string, unknown>,
  campo: string,
  normalizar: (v: string) => string | null,
  mensagem: string,
  erros: Erros,
  opcional = false,
): string | undefined {
  const v = texto(body, campo, erros, opcional);
  if (v === undefined) return undefined;
  const n = normalizar(v);
  if (!n) erros.add(campo, mensagem);
  return n ?? undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function email(body: Record<string, unknown>, campo: string, erros: Erros, opcional = false): string | undefined {
  const v = texto(body, campo, erros, opcional);
  if (v !== undefined && !EMAIL.test(v)) erros.add(campo, 'E-mail inválido.');
  return v?.toLowerCase();
}

/** Telefone celular brasileiro em E.164 (+55 DDD número). */
export function telefone(body: Record<string, unknown>, campo: string, erros: Erros): string | undefined {
  const v = texto(body, campo, erros);
  if (v === undefined) return undefined;
  let d = v.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!/^55\d{10,11}$/.test(d)) {
    erros.add(campo, 'Telefone inválido. Use DDD + número.');
    return undefined;
  }
  return `+${d}`;
}

/** Erro de chave única do PostgreSQL, direto do driver ou embrulhado pelo Drizzle. */
export function violacaoUnica(e: unknown): string | null {
  for (let atual: any = e; atual; atual = atual.cause) {
    if (atual.code === '23505') return atual.constraint ?? atual.detail ?? 'registro';
  }
  return null;
}
