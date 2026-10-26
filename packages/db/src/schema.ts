import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export type Transportador = typeof transportadores.$inferSelect;
export type NovoTransportador = typeof transportadores.$inferInsert;
export type Veiculo = typeof veiculos.$inferSelect;
export type NovoVeiculo = typeof veiculos.$inferInsert;
export type Embarcador = typeof embarcadores.$inferSelect;
export type NovoEmbarcador = typeof embarcadores.$inferInsert;
