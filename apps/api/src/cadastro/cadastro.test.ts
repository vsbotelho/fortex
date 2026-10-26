import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Db, transportadores } from '@fortex/db';
import { bancoDeTeste } from '@fortex/db/dist/teste';
import { CadastroController } from './cadastro.controller';
import { CadastroService } from './cadastro.service';

let ctx: Awaited<ReturnType<typeof bancoDeTeste>>;
let api: CadastroController;

beforeEach(async () => {
  ctx = await bancoDeTeste();
  api = new CadastroController(new CadastroService(ctx.db as unknown as Db));
});
afterEach(async () => {
  await ctx.fechar();
});

const tac = {
  tipo: 'TAC',
  documento: '529.982.247-25',
  nome: 'João da Silva',
  rntrc: '12345678',
  cnh: '01234567890',
  telefone: '(64) 99999-0000',
};

async function erroDe(p: Promise<unknown> | (() => unknown)) {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    return e as any;
  }
  throw new Error('esperava erro');
}

describe('cadastro de transportador', () => {
  it('normaliza documentos e começa pendente, sem poder receber ofertas', async () => {
    const t = await api.criarTransportador(tac);
    expect(t).toMatchObject({ documento: '52998224725', rntrc: '012345678', telefone: '+5564999990000', statusVerificacao: 'PENDENTE' });
    expect(t.elegibilidade.apto).toBe(false);
    expect(t.elegibilidade.pendencias).toHaveLength(2);
  });

  it('devolve todos os campos inválidos de uma vez', async () => {
    const e = await erroDe(() => api.criarTransportador({ tipo: 'TAC', documento: '123', rntrc: '1', telefone: '9' }));
    expect(e).toBeInstanceOf(BadRequestException);
    expect(Object.keys(e.getResponse().campos).sort()).toEqual(['cnh', 'documento', 'nome', 'rntrc', 'telefone']);
  });

  it('ETC usa CNPJ (inclusive alfanumérico) e dispensa CNH', async () => {
    const t = await api.criarTransportador({ ...tac, tipo: 'ETC', documento: '12.ABC.345/01DE-35', cnh: undefined });
    expect(t.documento).toBe('12ABC34501DE35');
    expect(t.cnh).toBeNull();
  });

  it('recusa CPF ou RNTRC já cadastrados', async () => {
    await api.criarTransportador(tac);
    const e = await erroDe(api.criarTransportador({ ...tac, rntrc: '987654321' }));
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getResponse().mensagem).toMatch(/CPF\/CNPJ/);
  });

  it('fica apto só com cadastro aprovado e veículo ativo', async () => {
    const t = await api.criarTransportador(tac);
    await api.adicionarVeiculo(t.id, { placa: 'bra-2e19', renavam: '639884962', eixos: 5, carroceria: 'GRANELEIRO' });
    expect((await api.obterTransportador(t.id)).elegibilidade.apto).toBe(false);

    await ctx.db.update(transportadores).set({ statusVerificacao: 'APROVADO' }).where(eq(transportadores.id, t.id));
    const detalhe = await api.obterTransportador(t.id);
    expect(detalhe.veiculos[0]).toMatchObject({ placa: 'BRA2E19', renavam: '00639884962' });
    expect(detalhe.elegibilidade).toEqual({ apto: true, pendencias: [] });
  });

  it('valida veículo e recusa placa repetida', async () => {
    const t = await api.criarTransportador(tac);
    const e = await erroDe(() => api.adicionarVeiculo(t.id, { placa: 'X', renavam: '00639884963', eixos: 8, carroceria: 'BAU' }));
    expect(Object.keys(e.getResponse().campos).sort()).toEqual(['carroceria', 'eixos', 'placa', 'renavam']);

    await api.adicionarVeiculo(t.id, { placa: 'ABC1234', renavam: '00639884962', eixos: 6, carroceria: 'BASCULANTE' });
    const dup = await erroDe(api.adicionarVeiculo(t.id, { placa: 'ABC1234', renavam: '00639884962', eixos: 6, carroceria: 'BASCULANTE' }));
    expect(dup).toBeInstanceOf(ConflictException);
  });

  it('404 para transportador inexistente', async () => {
    const e = await erroDe(api.obterTransportador('00000000-0000-0000-0000-000000000000'));
    expect(e).toBeInstanceOf(NotFoundException);
  });
});

describe('cadastro de embarcador', () => {
  it('aceita CNPJ ou CPF de produtor rural', async () => {
    const pj = await api.criarEmbarcador({ documento: '11.222.333/0001-81', nome: 'Armazém', telefone: '64 3611-0000', email: 'Compras@Exemplo.com' });
    expect(pj).toMatchObject({ documento: '11222333000181', email: 'compras@exemplo.com', statusVerificacao: 'PENDENTE' });
    const pf = await api.criarEmbarcador({ documento: '529.982.247-25', nome: 'Produtor', telefone: '64999990000', email: 'p@exemplo.com' });
    expect(pf.documento).toBe('52998224725');
  });

  it('exige e-mail válido', async () => {
    const e = await erroDe(() => api.criarEmbarcador({ documento: '11222333000181', nome: 'X', telefone: '64999990000', email: 'sem-arroba' }));
    expect(e.getResponse().campos).toEqual({ email: 'E-mail inválido.' });
  });
});
