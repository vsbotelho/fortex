import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fretes } from '@fortex/db';
import { AppDeTeste, criarAppDeTeste, gerarCpf, gerarRenavam } from '../teste/app-de-teste';

const RIO_VERDE = { nome: 'Rio Verde, GO', lat: -17.7923, lng: -50.9192 };
const UBERLANDIA = { nome: 'Uberlândia, MG', lat: -18.9186, lng: -48.2772 };
const ACREUNA = { nome: 'Acreúna, GO', lat: -17.396, lng: -50.3748 };
const UBERABA = { nome: 'Uberaba, MG', lat: -19.7472, lng: -47.9381 };
const BRASILIA = { nome: 'Brasília, DF', lat: -15.7939, lng: -47.8828 };

const HORA = 60 * 60 * 1000;
const PISO_430_KM_5_EIXOS = 361_240; // 430 × R$ 6,8548 + R$ 664,83 (Portaria SUROC 22/2026)

let app: AppDeTeste;
let admin: string;
let seq = 0;

beforeEach(async () => {
  app = await criarAppDeTeste();
  admin = await app.entrar('+5561900000000');
  await app.promoverAdmin('+5561900000000');
});
afterEach(async () => {
  await app.fechar();
});

function telefone() {
  return `+55649${String(++seq).padStart(8, '0')}`;
}

async function embarcador(aprovar = true) {
  const token = await app.entrar(telefone());
  const doc = gerarCpf(500_000_000 + seq);
  const { corpo } = await app.req('POST', '/embarcadores', { token, corpo: { documento: doc, nome: `Armazém ${seq}`, email: `e${seq}@exemplo.com` } });
  if (aprovar) await app.req('POST', `/admin/embarcadores/${corpo.id}/verificacao`, { token: admin, corpo: { decisao: 'APROVADO' } });
  return token;
}

async function motorista(posicao: { lat: number; lng: number }, opcoes: { destino?: typeof UBERABA; eixos?: number; aprovar?: boolean } = {}) {
  const n = ++seq;
  const token = await app.entrar(telefone());
  const { corpo: t } = await app.req('POST', '/transportadores', {
    token,
    corpo: { tipo: 'TAC', documento: gerarCpf(100_000_000 + n), nome: `Motorista ${n}`, rntrc: String(10_000_000 + n), cnh: String(10_000_000_000 + n) },
  });
  const placa = `ABC${String(n).padStart(4, '0')}`;
  await app.req('POST', `/transportadores/${t.id}/veiculos`, {
    token,
    corpo: { placa, renavam: gerarRenavam(1_000_000 + n), eixos: opcoes.eixos ?? 5, carroceria: 'GRANELEIRO' },
  });
  if (opcoes.aprovar !== false) {
    await app.req('POST', `/admin/transportadores/${t.id}/verificacao`, { token: admin, corpo: { decisao: 'APROVADO' } });
  }
  await app.req('PUT', '/motorista/disponibilidade', { token, corpo: { disponivel: true, posicao, destino: opcoes.destino ?? null } });
  return { token, id: t.id as string, placa };
}

function pedido(extra: Record<string, unknown> = {}) {
  const agora = Date.now();
  return {
    origem: RIO_VERDE,
    destino: UBERLANDIA,
    distanciaKm: 430,
    produto: 'Soja',
    pesoKg: 37_000,
    eixos: 5,
    carroceria: 'GRANELEIRO',
    coletaInicio: new Date(agora + HORA).toISOString(),
    coletaFim: new Date(agora + 24 * HORA).toISOString(),
    valePedagio: 25_000,
    ...extra,
  };
}

async function publicar(token: string, extra: Record<string, unknown> = {}) {
  const r = await app.req('POST', '/fretes', { token, corpo: pedido(extra) });
  if (r.status !== 201) throw new Error(`publicar: ${r.status} ${JSON.stringify(r.corpo)}`);
  return r.corpo;
}

describe('publicação', () => {
  it('embarcador não aprovado não publica', async () => {
    const r = await app.req('POST', '/fretes', { token: await embarcador(false), corpo: pedido() });
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('EMBARCADOR_NAO_APROVADO');
  });

  it('motorista não publica', async () => {
    const m = await motorista(RIO_VERDE);
    expect((await app.req('POST', '/fretes', { token: m.token, corpo: pedido() })).status).toBe(403);
  });

  it('sem valor informado, publica pelo piso, com cotação congelada e frete integral ao motorista', async () => {
    const f = await publicar(await embarcador());
    expect(f).toMatchObject({
      status: 'PUBLICADO',
      pisoCentavos: PISO_430_KM_5_EIXOS,
      freteCentavos: PISO_430_KM_5_EIXOS,
      adiantamentoPercentual: 40,
      adiantamentoCentavos: 144_496,
      saldoCentavos: 216_744,
      valePedagioCentavos: 25_000,
      taxaFortexCentavos: 28_899,
      normaPiso: expect.stringContaining('SUROC 22/2026'),
    });
  });

  it('bloqueia frete abaixo do piso e não grava nada', async () => {
    const r = await app.req('POST', '/fretes', { token: await embarcador(), corpo: pedido({ frete: 129_000 }) });
    expect(r.status).toBe(422);
    expect(r.corpo).toMatchObject({ codigo: 'ABAIXO_DO_PISO', piso: PISO_430_KM_5_EIXOS });
    expect(await app.db.select().from(fretes)).toHaveLength(0);
  });

  it('aceita valor acima do piso', async () => {
    const f = await publicar(await embarcador(), { frete: 400_000 });
    expect(f.freteCentavos).toBe(400_000);
  });

  it('recusa distância menor que a linha reta (piso artificialmente baixo)', async () => {
    const r = await app.req('POST', '/fretes', { token: await embarcador(), corpo: pedido({ distanciaKm: 150 }) });
    expect(r.status).toBe(400);
    expect(r.corpo.campos.distanciaKm).toMatch(/linha reta/);
  });

  it('devolve todos os campos inválidos de uma vez', async () => {
    const r = await app.req('POST', '/fretes', {
      token: await embarcador(),
      corpo: { origem: { nome: 'X', lat: 17, lng: 50 }, eixos: 8, carroceria: 'BAU', coletaInicio: 'amanhã' },
    });
    expect(r.status).toBe(400);
    expect(Object.keys(r.corpo.campos).sort()).toEqual(
      ['carroceria', 'coletaFim', 'coletaInicio', 'destino', 'distanciaKm', 'eixos', 'origem', 'pesoKg', 'produto', 'valePedagio'].sort(),
    );
  });

  it('avisa os motoristas compatíveis: quem volta para o destino primeiro', async () => {
    const perto = await motorista(RIO_VERDE);
    const voltando = await motorista(ACREUNA, { destino: UBERABA });
    await motorista(BRASILIA); // longe da coleta
    await motorista(RIO_VERDE, { eixos: 6 }); // veículo incompatível
    await motorista(RIO_VERDE, { aprovar: false }); // cadastro pendente

    const f = await publicar(await embarcador());
    expect(f.motoristasCompativeis).toBe(2);
    const aviso = app.notificador.novos.find((n) => n.freteId === f.id)!;
    expect(aviso.candidatos.map((c) => c.transportadorId)).toEqual([voltando.id, perto.id]);
  });
});

describe('ofertas e aceite', () => {
  it('motorista vê as ofertas compatíveis com o selo de retorno', async () => {
    const m = await motorista(ACREUNA, { destino: UBERABA });
    const f = await publicar(await embarcador());
    const r = await app.req('GET', '/motorista/ofertas', { token: m.token });
    expect(r.corpo.apto).toBe(true);
    expect(r.corpo.ofertas).toHaveLength(1);
    expect(r.corpo.ofertas[0]).toMatchObject({ id: f.id, retorno: true, freteCentavos: PISO_430_KM_5_EIXOS });
  });

  it('motorista pendente vê o que falta, sem ofertas', async () => {
    const m = await motorista(RIO_VERDE, { aprovar: false });
    await publicar(await embarcador());
    const r = await app.req('GET', '/motorista/ofertas', { token: m.token });
    expect(r.corpo.apto).toBe(false);
    expect(r.corpo.pendencias.join(' ')).toMatch(/verificação/);
    expect(r.corpo.ofertas).toEqual([]);
  });

  it('motorista longe ou incompatível não aceita', async () => {
    const longe = await motorista(BRASILIA);
    const f = await publicar(await embarcador());
    const r = await app.req('POST', `/fretes/${f.id}/aceitar`, { token: longe.token });
    expect(r.status).toBe(403);
    expect(r.corpo.codigo).toBe('NAO_COMPATIVEL');
  });

  it('o primeiro leva; o segundo recebe conflito; o embarcador vê quem vai buscar', async () => {
    const a = await motorista(RIO_VERDE);
    const b = await motorista(RIO_VERDE);
    const emb = await embarcador();
    const f = await publicar(emb);

    const ra = await app.req('POST', `/fretes/${f.id}/aceitar`, { token: a.token });
    expect(ra.status).toBe(200);
    expect(ra.corpo).toMatchObject({ status: 'ACEITO', transportadorId: a.id });
    const rb = await app.req('POST', `/fretes/${f.id}/aceitar`, { token: b.token });
    expect(rb.status).toBe(409);

    const visto = await app.req('GET', `/fretes/${f.id}`, { token: emb });
    expect(visto.corpo.motorista).toMatchObject({ nome: expect.stringContaining('Motorista'), placa: a.placa });
    expect((await app.req('GET', '/motorista/ofertas', { token: b.token })).corpo.ofertas).toEqual([]);
    expect(app.notificador.aceitos).toEqual([f.id]);
  });

  it('dois aceites ao mesmo tempo: só um vence', async () => {
    const a = await motorista(RIO_VERDE);
    const b = await motorista(RIO_VERDE);
    const f = await publicar(await embarcador());
    const [ra, rb] = await Promise.all([
      app.req('POST', `/fretes/${f.id}/aceitar`, { token: a.token }),
      app.req('POST', `/fretes/${f.id}/aceitar`, { token: b.token }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
  });

  it('motorista com frete em andamento não aceita outro', async () => {
    const m = await motorista(RIO_VERDE);
    const emb = await embarcador();
    const f1 = await publicar(emb);
    const f2 = await publicar(emb);
    expect((await app.req('POST', `/fretes/${f1.id}/aceitar`, { token: m.token })).status).toBe(200);
    expect((await app.req('POST', `/fretes/${f2.id}/aceitar`, { token: m.token })).status).toBe(403);
  });

  it('frete com coleta vencida sai das ofertas', async () => {
    const m = await motorista(RIO_VERDE);
    await publicar(await embarcador());
    app.avancar(25 * HORA);
    await app.req('PUT', '/motorista/disponibilidade', { token: m.token, corpo: { disponivel: true, posicao: RIO_VERDE } });
    expect((await app.req('GET', '/motorista/ofertas', { token: m.token })).corpo.ofertas).toEqual([]);
  });
});

describe('ciclo do frete', () => {
  async function aceito() {
    const m = await motorista(RIO_VERDE);
    const emb = await embarcador();
    const f = await publicar(emb);
    await app.req('POST', `/fretes/${f.id}/aceitar`, { token: m.token });
    return { m, emb, f };
  }
  const mudar = (token: string, id: string, para: string, motivo?: string) =>
    app.req('POST', `/fretes/${id}/status`, { token, corpo: { para, motivo } });

  it('da coleta à entrega, com a linha do tempo completa', async () => {
    const { m, emb, f } = await aceito();
    expect((await mudar(emb, f.id, 'EM_COLETA')).status).toBe(409); // só o motorista marca
    for (const para of ['EM_COLETA', 'EM_TRANSITO', 'ENTREGUE']) {
      expect((await mudar(m.token, f.id, para)).status).toBe(200);
    }
    const r = await app.req('GET', `/fretes/${f.id}`, { token: emb });
    expect(r.corpo.status).toBe('ENTREGUE');
    expect(r.corpo.eventos.map((e: any) => e.para)).toEqual(['PUBLICADO', 'ACEITO', 'EM_COLETA', 'EM_TRANSITO', 'ENTREGUE']);
  });

  it('não pula etapas', async () => {
    const { m, f } = await aceito();
    const r = await mudar(m.token, f.id, 'ENTREGUE');
    expect(r.status).toBe(409);
    expect(r.corpo.codigo).toBe('TRANSICAO_INVALIDA');
  });

  it('desistência antes da coleta devolve o frete à vitrine e avisa de novo', async () => {
    const { m, f } = await aceito();
    const outro = await motorista(RIO_VERDE);
    const r = await mudar(m.token, f.id, 'PUBLICADO');
    expect(r.corpo).toMatchObject({ status: 'PUBLICADO', transportadorId: null });
    expect(app.notificador.novos.filter((n) => n.freteId === f.id)).toHaveLength(2);
    expect((await app.req('POST', `/fretes/${f.id}/aceitar`, { token: outro.token })).status).toBe(200);
  });

  it('cancelamento exige motivo; carga divergente na coleta; nada cancela em trânsito', async () => {
    const { m, emb, f } = await aceito();
    await mudar(m.token, f.id, 'EM_COLETA');
    expect((await mudar(m.token, f.id, 'CANCELADO')).status).toBe(400);
    const r = await mudar(m.token, f.id, 'CANCELADO', 'Carga divergente: milho em vez de soja');
    expect(r.corpo).toMatchObject({ status: 'CANCELADO', motivoCancelamento: 'Carga divergente: milho em vez de soja' });

    const outro = await aceito();
    await mudar(outro.m.token, outro.f.id, 'EM_COLETA');
    await mudar(outro.m.token, outro.f.id, 'EM_TRANSITO');
    expect((await mudar(outro.emb, outro.f.id, 'CANCELADO', 'Desisti')).status).toBe(409);
    void emb;
  });

  it('cada um só vê os próprios fretes', async () => {
    const { f } = await aceito();
    const outroEmbarcador = await embarcador();
    const outroMotorista = await motorista(RIO_VERDE);
    expect((await app.req('GET', `/fretes/${f.id}`, { token: outroEmbarcador })).status).toBe(403);
    expect((await app.req('GET', `/fretes/${f.id}`, { token: outroMotorista.token })).status).toBe(403);
    expect((await app.req('GET', '/fretes', { token: outroEmbarcador })).corpo).toEqual([]);
    expect((await app.req('GET', `/fretes/${f.id}`, { token: admin })).status).toBe(200);
  });
});
