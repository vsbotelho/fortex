import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDeTeste, criarAppDeTeste } from '../teste/app-de-teste';

let app: AppDeTeste;
beforeEach(async () => {
  app = await criarAppDeTeste();
});
afterEach(async () => {
  await app.fechar();
});

const TEL = '+5564999990000';

describe('login por código', () => {
  it('primeiro acesso cria usuário NOVO e /eu responde com o token', async () => {
    const token = await app.entrar('(64) 99999-0000');
    const eu = await app.req('GET', '/eu', { token });
    expect(eu.status).toBe(200);
    expect(eu.corpo).toMatchObject({ telefone: TEL, papel: 'NOVO', transportadorId: null });
  });

  it('código errado não entra', async () => {
    await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } });
    const certo = app.enviador.ultimo.get(TEL)!;
    const errado = certo === '000000' ? '111111' : '000000';
    const r = await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo: errado } });
    expect(r.status).toBe(401);
  });

  it('código vale uma vez só', async () => {
    await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } });
    const codigo = app.enviador.ultimo.get(TEL);
    expect((await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo } })).status).toBe(200);
    expect((await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo } })).status).toBe(401);
  });

  it('código expira em 10 minutos', async () => {
    await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } });
    app.avancar(10 * 60_000 + 1);
    const r = await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo: app.enviador.ultimo.get(TEL) } });
    expect(r.status).toBe(401);
  });

  it('bloqueia o código depois de 5 tentativas erradas', async () => {
    await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } });
    const certo = app.enviador.ultimo.get(TEL)!;
    const errado = certo === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo: errado } });
    const r = await app.req('POST', '/auth/entrar', { corpo: { telefone: TEL, codigo: certo } });
    expect(r.status).toBe(401);
    expect(r.corpo.codigo).toBe('MUITAS_TENTATIVAS');
  });

  it('limita 3 códigos a cada 15 minutos por telefone', async () => {
    for (let i = 0; i < 3; i++) expect((await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } })).status).toBe(202);
    expect((await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } })).status).toBe(429);
    app.avancar(15 * 60_000 + 1);
    expect((await app.req('POST', '/auth/codigo', { corpo: { telefone: TEL } })).status).toBe(202);
  });

  it('sair revoga o token', async () => {
    const token = await app.entrar(TEL);
    expect((await app.req('POST', '/auth/sair', { token })).status).toBe(204);
    expect((await app.req('GET', '/eu', { token })).status).toBe(401);
  });

  it('sessão expira em 30 dias', async () => {
    const token = await app.entrar(TEL);
    app.avancar(30 * 24 * 60 * 60_000 + 1);
    expect((await app.req('GET', '/eu', { token })).status).toBe(401);
  });

  it('rotas protegidas exigem login; health e cotação são públicas', async () => {
    expect((await app.req('GET', '/eu')).status).toBe(401);
    expect((await app.req('GET', '/eu', { token: 'inventado' })).status).toBe(401);
    expect((await app.req('GET', '/health')).status).toBe(200);
    const cot = await app.req('POST', '/cotacoes', {
      corpo: { tipoCarga: 'GRANEL_SOLIDO', eixos: 5, distanciaKm: 430, adiantamentoPercentual: 40 },
    });
    expect(cot.status).toBe(200);
  });
});
