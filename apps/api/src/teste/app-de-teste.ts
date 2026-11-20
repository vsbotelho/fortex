import 'reflect-metadata';
import { INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Db, usuarios } from '@fortex/db';
import { bancoDeTeste } from '@fortex/db/dist/teste';
import { eq } from 'drizzle-orm';
import { CONTROLADORES, PROVEDORES } from '../app.module';
import { AUTH_CONFIG, configDoAmbiente, ENVIADOR_CODIGO, EnviadorCodigo, RELOGIO } from '../auth/config';
import { DB } from '../db/tokens';
import type { Candidato } from '../fretes/matching';
import { NOTIFICADOR_FRETES, NotificadorFretes } from '../fretes/notificador';
import type { Frete } from '@fortex/db';

/** Guarda os avisos que seriam enviados aos motoristas e embarcadores. */
export class NotificadorFalso implements NotificadorFretes {
  novos: { freteId: string; candidatos: Candidato[] }[] = [];
  aceitos: string[] = [];
  mudancas: { freteId: string; de: string; para: string }[] = [];
  async novoFrete(f: Frete, candidatos: Candidato[]) {
    this.novos.push({ freteId: f.id, candidatos });
  }
  async freteAceito(f: Frete) {
    this.aceitos.push(f.id);
  }
  async statusAlterado(f: Frete, de: Frete['status']) {
    this.mudancas.push({ freteId: f.id, de, para: f.status });
  }
}

/** CPF válido a partir de um número de 9 dígitos (para dados de teste). */
export function gerarCpf(base: number): string {
  const d = String(base).padStart(9, '0').split('').map(Number);
  for (const peso of [10, 11]) {
    const soma = d.reduce((s, n, i) => s + n * (peso - i), 0);
    const r = (soma * 10) % 11;
    d.push(r === 10 ? 0 : r);
  }
  return d.join('');
}

/** RENAVAM válido a partir de um número de 10 dígitos (para dados de teste). */
export function gerarRenavam(base: number): string {
  const d = String(base).padStart(10, '0').split('').map(Number);
  const pesos = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const r = (d.reduce((s, n, i) => s + n * pesos[i], 0) * 10) % 11;
  return d.join('') + (r === 10 ? 0 : r);
}

/** Captura os códigos que seriam enviados por SMS/WhatsApp. */
export class EnviadorFalso implements EnviadorCodigo {
  ultimo = new Map<string, string>();
  async enviar(telefone: string, codigo: string) {
    this.ultimo.set(telefone, codigo);
  }
}

export interface AppDeTeste {
  url: string;
  db: Db;
  enviador: EnviadorFalso;
  notificador: NotificadorFalso;
  /** Avança o relógio da aplicação. */
  avancar(ms: number): void;
  /** Faz login pelo fluxo real e devolve o token. */
  entrar(telefone: string): Promise<string>;
  promoverAdmin(telefone: string): Promise<void>;
  req(metodo: string, caminho: string, opcoes?: { token?: string; corpo?: unknown }): Promise<{ status: number; corpo: any }>;
  fechar(): Promise<void>;
}

const SUBSTITUIDOS = new Set<unknown>([AUTH_CONFIG, ENVIADOR_CODIGO, RELOGIO, NOTIFICADOR_FRETES]);

export async function criarAppDeTeste(): Promise<AppDeTeste> {
  const banco = await bancoDeTeste();
  const db = banco.db as unknown as Db;
  const enviador = new EnviadorFalso();
  const notificador = new NotificadorFalso();
  let deslocamento = 0;

  @Module({
    controllers: CONTROLADORES,
    providers: [
      ...PROVEDORES.filter((p) => !(typeof p === 'object' && 'provide' in p && SUBSTITUIDOS.has(p.provide))),
      { provide: DB, useValue: db },
      { provide: AUTH_CONFIG, useValue: configDoAmbiente({}) },
      { provide: ENVIADOR_CODIGO, useValue: enviador },
      { provide: NOTIFICADOR_FRETES, useValue: notificador },
      { provide: RELOGIO, useValue: () => new Date(Date.now() + deslocamento) },
    ],
  })
  class ModuloDeTeste {}

  const app: INestApplication = await NestFactory.create(ModuloDeTeste, { logger: false });
  await app.listen(0);
  const url = await app.getUrl();

  const req: AppDeTeste['req'] = async (metodo, caminho, opcoes = {}) => {
    const r = await fetch(`${url.replace('[::1]', 'localhost')}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(opcoes.token ? { Authorization: `Bearer ${opcoes.token}` } : {}),
      },
      body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
    });
    const texto = await r.text();
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
  };

  const entrar = async (telefone: string) => {
    const pedido = await req('POST', '/auth/codigo', { corpo: { telefone } });
    if (pedido.status !== 202) throw new Error(`pedir código: ${pedido.status}`);
    const tel = `+55${telefone.replace(/\D/g, '').replace(/^55/, '')}`;
    const r = await req('POST', '/auth/entrar', { corpo: { telefone, codigo: enviador.ultimo.get(tel) } });
    if (r.status !== 200) throw new Error(`entrar: ${r.status} ${JSON.stringify(r.corpo)}`);
    return r.corpo.token as string;
  };

  return {
    url,
    db,
    enviador,
    notificador,
    avancar: (ms) => {
      deslocamento += ms;
    },
    entrar,
    promoverAdmin: async (telefone) => {
      await db.update(usuarios).set({ papel: 'ADMIN' }).where(eq(usuarios.telefone, telefone));
    },
    req,
    fechar: async () => {
      await app.close();
      await banco.fechar();
    },
  };
}
