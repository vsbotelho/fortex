import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { auditoria } from '@fortex/db';
import { AppDeTeste, criarAppDeTeste } from '../teste/app-de-teste';

let app: AppDeTeste;
beforeEach(async () => {
  app = await criarAppDeTeste();
});
afterEach(async () => {
  await app.fechar();
});

const tac = { tipo: 'TAC', documento: '529.982.247-25', nome: 'João da Silva', rntrc: '12345678', cnh: '01234567890' };
const veiculo = { placa: 'bra-2e19', renavam: '639884962', eixos: 5, carroceria: 'GRANELEIRO' };

async function admin() {
  const token = await app.entrar('+5561999990009');
  await app.promoverAdmin('+5561999990009');
  return token;
}

describe('cadastro de transportador', () => {
  it('vincula ao usuário logado, usa o telefone do login e começa pendente', async () => {
    const token = await app.entrar('+5564999990000');
    const r = await app.req('POST', '/transportadores', { token, corpo: tac });
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ documento: '52998224725', rntrc: '012345678', telefone: '+5564999990000', statusVerificacao: 'PENDENTE' });
    expect(r.corpo.elegibilidade.apto).toBe(false);

    const eu = await app.req('GET', '/eu', { token });
    expect(eu.corpo).toMatchObject({ papel: 'MOTORISTA', transportadorId: r.corpo.id });
  });

  it('um telefone, um cadastro', async () => {
    const token = await app.entrar('+5564999990000');
    await app.req('POST', '/transportadores', { token, corpo: tac });
    expect((await app.req('POST', '/transportadores', { token, corpo: { ...tac, documento: '11144477735', rntrc: '87654321' } })).status).toBe(403);
    expect((await app.req('POST', '/embarcadores', { token, corpo: { documento: '11222333000181', nome: 'X', email: 'x@exemplo.com' } })).status).toBe(403);
  });

  it('devolve todos os campos inválidos de uma vez', async () => {
    const token = await app.entrar('+5564999990000');
    const r = await app.req('POST', '/transportadores', { token, corpo: { tipo: 'TAC', documento: '123', rntrc: '1' } });
    expect(r.status).toBe(400);
    expect(Object.keys(r.corpo.campos).sort()).toEqual(['cnh', 'documento', 'nome', 'rntrc']);
  });

  it('recusa CPF já cadastrado por outro telefone, sem vincular o usuário', async () => {
    const t1 = await app.entrar('+5564999990000');
    await app.req('POST', '/transportadores', { token: t1, corpo: tac });
    const t2 = await app.entrar('+5564999990001');
    const r = await app.req('POST', '/transportadores', { token: t2, corpo: { ...tac, rntrc: '87654321' } });
    expect(r.status).toBe(409);
    expect((await app.req('GET', '/eu', { token: t2 })).corpo.papel).toBe('NOVO');
  });

  it('ETC usa CNPJ, inclusive alfanumérico, e dispensa CNH', async () => {
    const token = await app.entrar('+5564999990000');
    const r = await app.req('POST', '/transportadores', { token, corpo: { ...tac, tipo: 'ETC', documento: '12.ABC.345/01DE-35', cnh: undefined } });
    expect(r.status).toBe(201);
    expect(r.corpo).toMatchObject({ documento: '12ABC34501DE35', cnh: null });
  });

  it('ninguém vê nem altera o cadastro de outro motorista', async () => {
    const t1 = await app.entrar('+5564999990000');
    const { corpo } = await app.req('POST', '/transportadores', { token: t1, corpo: tac });
    const t2 = await app.entrar('+5564999990001');
    await app.req('POST', '/transportadores', { token: t2, corpo: { ...tac, documento: '11144477735', rntrc: '87654321' } });
    expect((await app.req('GET', `/transportadores/${corpo.id}`, { token: t2 })).status).toBe(403);
    expect((await app.req('POST', `/transportadores/${corpo.id}/veiculos`, { token: t2, corpo: veiculo })).status).toBe(403);
  });

  it('valida veículo e recusa placa repetida', async () => {
    const token = await app.entrar('+5564999990000');
    const { corpo: t } = await app.req('POST', '/transportadores', { token, corpo: tac });
    const ruim = await app.req('POST', `/transportadores/${t.id}/veiculos`, { token, corpo: { placa: 'X', renavam: '00639884963', eixos: 8, carroceria: 'BAU' } });
    expect(Object.keys(ruim.corpo.campos).sort()).toEqual(['carroceria', 'eixos', 'placa', 'renavam']);
    expect((await app.req('POST', `/transportadores/${t.id}/veiculos`, { token, corpo: veiculo })).status).toBe(201);
    expect((await app.req('POST', `/transportadores/${t.id}/veiculos`, { token, corpo: veiculo })).status).toBe(409);
  });
});

describe('cadastro de embarcador', () => {
  it('aceita CNPJ ou CPF de produtor rural e vincula ao usuário', async () => {
    const t1 = await app.entrar('+5564999990000');
    const pj = await app.req('POST', '/embarcadores', { token: t1, corpo: { documento: '11.222.333/0001-81', nome: 'Armazém', email: 'Compras@Exemplo.com' } });
    expect(pj.corpo).toMatchObject({ documento: '11222333000181', email: 'compras@exemplo.com', telefone: '+5564999990000' });
    expect((await app.req('GET', '/eu', { token: t1 })).corpo.papel).toBe('EMBARCADOR');

    const t2 = await app.entrar('+5564999990001');
    const pf = await app.req('POST', '/embarcadores', { token: t2, corpo: { documento: '529.982.247-25', nome: 'Produtor', email: 'p@exemplo.com' } });
    expect(pf.corpo.documento).toBe('52998224725');
  });
});

describe('painel de verificação', () => {
  it('só ADMIN acessa', async () => {
    const token = await app.entrar('+5564999990000');
    expect((await app.req('GET', '/admin/cadastros/pendentes', { token })).status).toBe(403);
  });

  it('aprovação libera o motorista para ofertas e fica na auditoria', async () => {
    const tm = await app.entrar('+5564999990000');
    const { corpo: t } = await app.req('POST', '/transportadores', { token: tm, corpo: tac });
    await app.req('POST', `/transportadores/${t.id}/veiculos`, { token: tm, corpo: veiculo });

    const ta = await admin();
    const fila = await app.req('GET', '/admin/cadastros/pendentes', { token: ta });
    expect(fila.corpo.transportadores.map((x: any) => x.id)).toEqual([t.id]);

    const r = await app.req('POST', `/admin/transportadores/${t.id}/verificacao`, { token: ta, corpo: { decisao: 'APROVADO' } });
    expect(r.corpo.statusVerificacao).toBe('APROVADO');

    const detalhe = await app.req('GET', `/transportadores/${t.id}`, { token: tm });
    expect(detalhe.corpo.elegibilidade).toEqual({ apto: true, pendencias: [] });
    expect((await app.req('GET', '/admin/cadastros/pendentes', { token: ta })).corpo.transportadores).toHaveLength(0);

    const log = await app.db.select().from(auditoria);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ acao: 'DECISAO_VERIFICACAO', entidade: 'transportador', entidadeId: t.id, dados: { de: 'PENDENTE', para: 'APROVADO', motivo: null } });
  });

  it('reprovação exige motivo, que o motorista vê nas pendências', async () => {
    const tm = await app.entrar('+5564999990000');
    const { corpo: t } = await app.req('POST', '/transportadores', { token: tm, corpo: tac });
    const ta = await admin();
    const sem = await app.req('POST', `/admin/transportadores/${t.id}/verificacao`, { token: ta, corpo: { decisao: 'REPROVADO' } });
    expect(sem.status).toBe(400);
    await app.req('POST', `/admin/transportadores/${t.id}/verificacao`, { token: ta, corpo: { decisao: 'REPROVADO', motivo: 'RNTRC suspenso' } });
    const detalhe = await app.req('GET', `/transportadores/${t.id}`, { token: tm });
    expect(detalhe.corpo.elegibilidade.pendencias[0]).toContain('RNTRC suspenso');
  });

  it('aprova embarcador', async () => {
    const te = await app.entrar('+5564999990000');
    const { corpo: e } = await app.req('POST', '/embarcadores', { token: te, corpo: { documento: '11222333000181', nome: 'Armazém', email: 'a@exemplo.com' } });
    const ta = await admin();
    const r = await app.req('POST', `/admin/embarcadores/${e.id}/verificacao`, { token: ta, corpo: { decisao: 'APROVADO' } });
    expect(r.corpo.statusVerificacao).toBe('APROVADO');
  });
});
