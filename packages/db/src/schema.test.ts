import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bancoDeTeste } from './teste';
import { embarcadores, transportadores, veiculos } from './schema';

let ctx: Awaited<ReturnType<typeof bancoDeTeste>>;
beforeEach(async () => {
  ctx = await bancoDeTeste();
});
afterEach(async () => {
  await ctx.fechar();
});

const tac = {
  tipo: 'TAC' as const,
  documento: '52998224725',
  nome: 'Motorista Teste',
  rntrc: '012345678',
  cnh: '01234567890',
  telefone: '+5564999990000',
};

describe('esquema', () => {
  it('cria transportador pendente e veículo vinculado', async () => {
    const [t] = await ctx.db.insert(transportadores).values(tac).returning();
    expect(t.statusVerificacao).toBe('PENDENTE');
    await ctx.db.insert(veiculos).values({ transportadorId: t.id, placa: 'BRA2E19', renavam: '00639884962', eixos: 5, carroceria: 'GRANELEIRO' });
    const vs = await ctx.db.select().from(veiculos).where(eq(veiculos.transportadorId, t.id));
    expect(vs).toHaveLength(1);
  });

  it('exige CNH para TAC', async () => {
    await expect(ctx.db.insert(transportadores).values({ ...tac, cnh: null })).rejects.toThrow();
  });

  it('não aceita documento ou RNTRC duplicado', async () => {
    await ctx.db.insert(transportadores).values(tac);
    await expect(ctx.db.insert(transportadores).values({ ...tac, rntrc: '099999999' })).rejects.toThrow();
    await expect(ctx.db.insert(transportadores).values({ ...tac, documento: '11144477735' })).rejects.toThrow();
  });

  it('só aceita eixos da tabela ANTT (sem 8)', async () => {
    const [t] = await ctx.db.insert(transportadores).values(tac).returning();
    await expect(
      ctx.db.insert(veiculos).values({ transportadorId: t.id, placa: 'ABC1234', renavam: '00639884962', eixos: 8, carroceria: 'GRANELEIRO' }),
    ).rejects.toThrow();
  });

  it('exige motivo ao reprovar', async () => {
    const [t] = await ctx.db.insert(transportadores).values(tac).returning();
    await expect(
      ctx.db.update(transportadores).set({ statusVerificacao: 'REPROVADO' }).where(eq(transportadores.id, t.id)),
    ).rejects.toThrow();
  });

  it('cria embarcador', async () => {
    const [e] = await ctx.db
      .insert(embarcadores)
      .values({ documento: '11222333000181', nome: 'Armazém Teste', telefone: '+5564999990001', email: 'contato@exemplo.com' })
      .returning();
    expect(e.statusVerificacao).toBe('PENDENTE');
  });
});
