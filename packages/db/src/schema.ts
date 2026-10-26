import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tipoTransportador = pgEnum('tipo_transportador', ['TAC', 'ETC']);

export const statusVerificacao = pgEnum('status_verificacao', ['PENDENTE', 'EM_ANALISE', 'APROVADO', 'REPROVADO']);

/** Carrocerias aceitas no MVP de grãos. */
export const carroceria = pgEnum('carroceria', ['GRANELEIRO', 'BASCULANTE']);

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () => timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow();

/**
 * Transportador contratado: TAC (pessoa física, CPF) ou ETC (empresa, CNPJ).
 * Só recebe ofertas com verificação APROVADA e ao menos um veículo ativo.
 */
export const transportadores = pgTable(
  'transportadores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tipo: tipoTransportador('tipo').notNull(),
    /** CPF (TAC) ou CNPJ (ETC), sem máscara. */
    documento: text('documento').notNull().unique(),
    nome: text('nome').notNull(),
    rntrc: text('rntrc').notNull().unique(),
    /** Obrigatória para TAC, que dirige o próprio veículo. */
    cnh: text('cnh'),
    telefone: text('telefone').notNull(),
    email: text('email'),
    statusVerificacao: statusVerificacao('status_verificacao').notNull().default('PENDENTE'),
    motivoReprovacao: text('motivo_reprovacao'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check('tac_exige_cnh', sql`${t.tipo} <> 'TAC' OR ${t.cnh} IS NOT NULL`),
    check('reprovado_exige_motivo', sql`${t.statusVerificacao} <> 'REPROVADO' OR ${t.motivoReprovacao} IS NOT NULL`),
  ],
);

export const veiculos = pgTable(
  'veiculos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transportadorId: uuid('transportador_id')
      .notNull()
      .references(() => transportadores.id, { onDelete: 'restrict' }),
    placa: text('placa').notNull().unique(),
    renavam: text('renavam').notNull().unique(),
    /** Eixos carregados do conjunto, como na tabela de piso da ANTT. */
    eixos: integer('eixos').notNull(),
    carroceria: carroceria('carroceria').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    check('eixos_validos', sql`${t.eixos} IN (2, 3, 4, 5, 6, 7, 9)`),
    index('veiculos_transportador_idx').on(t.transportadorId),
  ],
);

/** Embarcador: contratante do frete, responsável pelo CIOT, piso e Vale-Pedágio. */
export const embarcadores = pgTable('embarcadores', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** CNPJ (ou CPF de produtor rural), sem máscara. */
  documento: text('documento').notNull().unique(),
  nome: text('nome').notNull(),
  telefone: text('telefone').notNull(),
  email: text('email').notNull(),
  statusVerificacao: statusVerificacao('status_verificacao').notNull().default('PENDENTE'),
  motivoReprovacao: text('motivo_reprovacao'),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}, (t) => [
  check('embarcador_reprovado_exige_motivo', sql`${t.statusVerificacao} <> 'REPROVADO' OR ${t.motivoReprovacao} IS NOT NULL`),
]);

/**
 * Papel do usuário. NOVO = entrou pelo telefone mas ainda não fez cadastro de
 * transportador nem de embarcador. ADMIN só é atribuído por script.
 */
export const papelUsuario = pgEnum('papel_usuario', ['NOVO', 'MOTORISTA', 'EMBARCADOR', 'ADMIN']);

export const usuarios = pgTable(
  'usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Celular em E.164 (+55...). É o login. */
    telefone: text('telefone').notNull().unique(),
    papel: papelUsuario('papel').notNull().default('NOVO'),
    transportadorId: uuid('transportador_id')
      .unique()
      .references(() => transportadores.id, { onDelete: 'restrict' }),
    embarcadorId: uuid('embarcador_id')
      .unique()
      .references(() => embarcadores.id, { onDelete: 'restrict' }),
    criadoEm: criadoEm(),
    ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
  },
  (t) => [
    check('um_vinculo_so', sql`${t.transportadorId} IS NULL OR ${t.embarcadorId} IS NULL`),
    check(
      'papel_coerente',
      sql`(${t.papel} <> 'MOTORISTA' OR ${t.transportadorId} IS NOT NULL) AND (${t.papel} <> 'EMBARCADOR' OR ${t.embarcadorId} IS NOT NULL)`,
    ),
  ],
);

/** Códigos de acesso enviados por SMS/WhatsApp. Guarda só o HMAC do código. */
export const codigosAcesso = pgTable(
  'codigos_acesso',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    telefone: text('telefone').notNull(),
    hash: text('hash').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    tentativas: integer('tentativas').notNull().default(0),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index('codigos_telefone_idx').on(t.telefone, t.criadoEm)],
);

/** Sessões de login. Guarda só o hash do token, para poder revogar. */
export const sessoes = pgTable(
  'sessoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    hashToken: text('hash_token').notNull().unique(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    revogadaEm: timestamp('revogada_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index('sessoes_usuario_idx').on(t.usuarioId)],
);

/** Registro de ações relevantes (aprovação de cadastro etc.). Só inserção. */
export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    acao: text('acao').notNull(),
    entidade: text('entidade').notNull(),
    entidadeId: uuid('entidade_id'),
    dados: jsonb('dados'),
    criadoEm: criadoEm(),
  },
  (t) => [index('auditoria_entidade_idx').on(t.entidade, t.entidadeId)],
);

export type Usuario = typeof usuarios.$inferSelect;
export type PapelUsuario = Usuario['papel'];
export type Transportador = typeof transportadores.$inferSelect;
export type NovoTransportador = typeof transportadores.$inferInsert;
export type Veiculo = typeof veiculos.$inferSelect;
export type NovoVeiculo = typeof veiculos.$inferInsert;
export type Embarcador = typeof embarcadores.$inferSelect;
export type NovoEmbarcador = typeof embarcadores.$inferInsert;
