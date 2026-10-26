import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import {
  auditoria,
  Db,
  Embarcador,
  embarcadores,
  NovoEmbarcador,
  NovoTransportador,
  NovoVeiculo,
  Transportador,
  transportadores,
  Usuario,
  usuarios,
  Veiculo,
  veiculos,
} from '@fortex/db';
import { DB } from '../db/tokens';
import { avaliarElegibilidade, Elegibilidade } from './elegibilidade';
import { violacaoUnica } from './entrada';

export interface TransportadorDetalhado extends Transportador {
  veiculos: Veiculo[];
  elegibilidade: Elegibilidade;
}

export type Decisao = 'EM_ANALISE' | 'APROVADO' | 'REPROVADO';

const MENSAGEM_DUPLICADO: Record<string, string> = {
  transportadores_documento_unique: 'Já existe transportador com este CPF/CNPJ.',
  transportadores_rntrc_unique: 'Já existe transportador com este RNTRC.',
  veiculos_placa_unique: 'Já existe veículo com esta placa.',
  veiculos_renavam_unique: 'Já existe veículo com este RENAVAM.',
  embarcadores_documento_unique: 'Já existe embarcador com este CPF/CNPJ.',
};

function traduzirDuplicidade(e: unknown): never {
  const chave = violacaoUnica(e);
  if (chave) {
    throw new ConflictException({ codigo: 'DUPLICADO', mensagem: MENSAGEM_DUPLICADO[chave] ?? 'Registro duplicado.' });
  }
  throw e;
}

function exigirUsuarioNovo(u: Usuario) {
  if (u.papel !== 'NOVO') {
    throw new ConflictException({ codigo: 'JA_CADASTRADO', mensagem: 'Este telefone já tem um cadastro no Fortex.' });
  }
}

const SEM_ACESSO = () => new ForbiddenException({ codigo: 'SEM_PERMISSAO', mensagem: 'Sem acesso a este cadastro.' });

@Injectable()
export class CadastroService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Cria o transportador e vincula ao usuário logado, que passa a MOTORISTA. */
  async criarTransportador(u: Usuario, dados: Omit<NovoTransportador, 'telefone'>): Promise<TransportadorDetalhado> {
    exigirUsuarioNovo(u);
    try {
      const t = await this.db.transaction(async (tx) => {
        const [novo] = await tx.insert(transportadores).values({ ...dados, telefone: u.telefone }).returning();
        await tx.update(usuarios).set({ papel: 'MOTORISTA', transportadorId: novo.id }).where(eq(usuarios.id, u.id));
        return novo;
      });
      return { ...t, veiculos: [], elegibilidade: avaliarElegibilidade(t, []) };
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  async obterTransportador(u: Usuario, id: string): Promise<TransportadorDetalhado> {
    if (u.papel !== 'ADMIN' && u.transportadorId !== id) throw SEM_ACESSO();
    const [t] = await this.db.select().from(transportadores).where(eq(transportadores.id, id));
    if (!t) throw new NotFoundException('Transportador não encontrado.');
    const vs = await this.db.select().from(veiculos).where(eq(veiculos.transportadorId, id));
    return { ...t, veiculos: vs, elegibilidade: avaliarElegibilidade(t, vs) };
  }

  async adicionarVeiculo(u: Usuario, transportadorId: string, dados: Omit<NovoVeiculo, 'transportadorId'>): Promise<Veiculo> {
    await this.obterTransportador(u, transportadorId);
    try {
      const [v] = await this.db.insert(veiculos).values({ ...dados, transportadorId }).returning();
      return v;
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  /** Cria o embarcador e vincula ao usuário logado, que passa a EMBARCADOR. */
  async criarEmbarcador(u: Usuario, dados: Omit<NovoEmbarcador, 'telefone'>): Promise<Embarcador> {
    exigirUsuarioNovo(u);
    try {
      return await this.db.transaction(async (tx) => {
        const [novo] = await tx.insert(embarcadores).values({ ...dados, telefone: u.telefone }).returning();
        await tx.update(usuarios).set({ papel: 'EMBARCADOR', embarcadorId: novo.id }).where(eq(usuarios.id, u.id));
        return novo;
      });
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  async obterEmbarcador(u: Usuario, id: string): Promise<Embarcador> {
    if (u.papel !== 'ADMIN' && u.embarcadorId !== id) throw SEM_ACESSO();
    const [e] = await this.db.select().from(embarcadores).where(eq(embarcadores.id, id));
    if (!e) throw new NotFoundException('Embarcador não encontrado.');
    return e;
  }

  /** Fila do painel: cadastros aguardando decisão. */
  async pendentes() {
    const abertos = ['PENDENTE', 'EM_ANALISE'] as const;
    const [ts, es] = await Promise.all([
      this.db.select().from(transportadores).where(inArray(transportadores.statusVerificacao, [...abertos])).orderBy(transportadores.criadoEm),
      this.db.select().from(embarcadores).where(inArray(embarcadores.statusVerificacao, [...abertos])).orderBy(embarcadores.criadoEm),
    ]);
    return { transportadores: ts, embarcadores: es };
  }

  /** Decisão do administrador, registrada na auditoria na mesma transação. */
  async decidir(admin: Usuario, entidade: 'transportador' | 'embarcador', id: string, decisao: Decisao, motivo?: string) {
    const tabela = entidade === 'transportador' ? transportadores : embarcadores;
    return this.db.transaction(async (tx) => {
      const [atual] = await tx.select({ status: tabela.statusVerificacao }).from(tabela).where(eq(tabela.id, id));
      if (!atual) throw new NotFoundException('Cadastro não encontrado.');
      const [atualizado] = await tx
        .update(tabela)
        .set({ statusVerificacao: decisao, motivoReprovacao: decisao === 'REPROVADO' ? motivo : null, atualizadoEm: new Date() })
        .where(eq(tabela.id, id))
        .returning();
      await tx.insert(auditoria).values({
        usuarioId: admin.id,
        acao: 'DECISAO_VERIFICACAO',
        entidade,
        entidadeId: id,
        dados: { de: atual.status, para: decisao, motivo: motivo ?? null },
      });
      return atualizado;
    });
  }
}
