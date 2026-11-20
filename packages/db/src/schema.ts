import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

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

/**
 * Ciclo do frete. PUBLICADO → ACEITO → EM_COLETA (chegou para carregar) →
 * EM_TRANSITO (coleta confirmada) → ENTREGUE. CANCELADO a partir de
 * PUBLICADO, ACEITO ou EM_COLETA (ex.: carga divergente). Se o motorista
 * desiste antes da coleta, o frete volta a PUBLICADO.
 */
export const statusFrete = pgEnum('status_frete', ['PUBLICADO', 'ACEITO', 'EM_COLETA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO']);

/** Mesmos valores do enum TipoCarga do motor de preço. O MVP usa GRANEL_SOLIDO. */
export const tipoCarga = pgEnum('tipo_carga', [
  'GRANEL_SOLIDO',
  'GRANEL_LIQUIDO',
  'FRIGORIFICADA',
  'CONTEINERIZADA',
  'CARGA_GERAL',
  'NEOGRANEL',
  'GRANEL_PRESSURIZADA',
]);

const lat = (nome: string) => doublePrecision(nome).notNull();

/**
 * Frete publicado por um embarcador. Guarda a cotação congelada no momento da
 * publicação (piso, norma, frete, adiantamento, Vale-Pedágio e taxa), para
 * que um reajuste posterior da ANTT não altere um frete já ofertado.
 * Valores em centavos.
 */
export const fretes = pgTable(
  'fretes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    embarcadorId: uuid('embarcador_id')
      .notNull()
      .references(() => embarcadores.id, { onDelete: 'restrict' }),

    origemNome: text('origem_nome').notNull(),
    origemLat: lat('origem_lat'),
    origemLng: lat('origem_lng'),
    destinoNome: text('destino_nome').notNull(),
    destinoLat: lat('destino_lat'),
    destinoLng: lat('destino_lng'),
    /** Distância rodoviária informada, base do piso. */
    distanciaKm: numeric('distancia_km', { precision: 8, scale: 1, mode: 'number' }).notNull(),

    tipoCarga: tipoCarga('tipo_carga').notNull(),
    produto: text('produto').notNull(),
    pesoKg: integer('peso_kg').notNull(),
    eixos: integer('eixos').notNull(),
    carroceria: carroceria('carroceria').notNull(),
    coletaInicio: timestamp('coleta_inicio', { withTimezone: true }).notNull(),
    coletaFim: timestamp('coleta_fim', { withTimezone: true }).notNull(),
    observacoes: text('observacoes'),

    pisoCentavos: integer('piso_centavos').notNull(),
    normaPiso: text('norma_piso').notNull(),
    freteCentavos: integer('frete_centavos').notNull(),
    adiantamentoPercentual: integer('adiantamento_percentual').notNull(),
    adiantamentoCentavos: integer('adiantamento_centavos').notNull(),
    saldoCentavos: integer('saldo_centavos').notNull(),
    valePedagioCentavos: integer('vale_pedagio_centavos').notNull(),
    taxaFortexCentavos: integer('taxa_fortex_centavos').notNull(),

    status: statusFrete('status').notNull().default('PUBLICADO'),
    transportadorId: uuid('transportador_id').references(() => transportadores.id, { onDelete: 'restrict' }),
    veiculoId: uuid('veiculo_id').references(() => veiculos.id, { onDelete: 'restrict' }),
    aceitoEm: timestamp('aceito_em', { withTimezone: true }),
    motivoCancelamento: text('motivo_cancelamento'),

    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    // Lei 15.485/2026: nada abaixo do piso, nem por erro de aplicação.
    check('frete_no_piso', sql`${t.freteCentavos} >= ${t.pisoCentavos} AND ${t.pisoCentavos} > 0`),
    // Lei 11.442, art. 13-B: o transportador recebe o frete inteiro.
    check('frete_integral', sql`${t.adiantamentoCentavos} + ${t.saldoCentavos} = ${t.freteCentavos}`),
    check('adiantamento_valido', sql`${t.adiantamentoPercentual} BETWEEN 0 AND 100`),
    check('frete_eixos_validos', sql`${t.eixos} IN (2, 3, 4, 5, 6, 7, 9)`),
    check('peso_positivo', sql`${t.pesoKg} > 0`),
    check('distancia_positiva', sql`${t.distanciaKm} > 0`),
    check('janela_coleta', sql`${t.coletaFim} > ${t.coletaInicio}`),
    check(
      'aceite_tem_motorista',
      sql`${t.status} IN ('PUBLICADO', 'CANCELADO') OR (${t.transportadorId} IS NOT NULL AND ${t.veiculoId} IS NOT NULL AND ${t.aceitoEm} IS NOT NULL)`,
    ),
    check('cancelado_exige_motivo', sql`${t.status} <> 'CANCELADO' OR ${t.motivoCancelamento} IS NOT NULL`),
    index('fretes_status_idx').on(t.status, t.coletaInicio),
    index('fretes_embarcador_idx').on(t.embarcadorId),
    // Um motorista com um frete em andamento por vez.
    uniqueIndex('um_frete_ativo_por_transportador')
      .on(t.transportadorId)
      .where(sql`${t.status} IN ('ACEITO', 'EM_COLETA', 'EM_TRANSITO')`),
  ],
);

/** Linha do tempo do frete: cada mudança de status, com quem e quando. Só inserção. */
export const freteEventos = pgTable(
  'frete_eventos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    freteId: uuid('frete_id')
      .notNull()
      .references(() => fretes.id, { onDelete: 'cascade' }),
    de: statusFrete('de'),
    para: statusFrete('para').notNull(),
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    dados: jsonb('dados'),
    criadoEm: criadoEm(),
  },
  (t) => [index('frete_eventos_frete_idx').on(t.freteId, t.criadoEm)],
);

/**
 * Onde o motorista está e para onde quer ir. Base do matching e do bônus de
 * retorno. Atualizada pelo app; vale por algumas horas.
 */
export const disponibilidades = pgTable('disponibilidades', {
  transportadorId: uuid('transportador_id')
    .primaryKey()
    .references(() => transportadores.id, { onDelete: 'cascade' }),
  disponivel: boolean('disponivel').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  destinoNome: text('destino_nome'),
  destinoLat: doublePrecision('destino_lat'),
  destinoLng: doublePrecision('destino_lng'),
  atualizadoEm: atualizadoEm(),
});

export type Frete = typeof fretes.$inferSelect;
export type NovoFrete = typeof fretes.$inferInsert;
export type StatusFrete = Frete['status'];
export type Disponibilidade = typeof disponibilidades.$inferSelect;

export type Usuario = typeof usuarios.$inferSelect;
export type PapelUsuario = Usuario['papel'];
export type Transportador = typeof transportadores.$inferSelect;
export type NovoTransportador = typeof transportadores.$inferInsert;
export type Veiculo = typeof veiculos.$inferSelect;
export type NovoVeiculo = typeof veiculos.$inferInsert;
export type Embarcador = typeof embarcadores.$inferSelect;
export type NovoEmbarcador = typeof embarcadores.$inferInsert;
