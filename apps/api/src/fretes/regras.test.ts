import { describe, expect, it } from 'vitest';
import type { Disponibilidade, Transportador, Veiculo } from '@fortex/db';
import { distanciaKm, noBrasil, validarDistanciaRodoviaria } from './geo';
import { candidatosParaFrete, CandidatoBruto, FreteParaMatching, VALIDADE_POSICAO_MS } from './matching';
import { podeTransitar } from './status';

const RIO_VERDE = { lat: -17.7923, lng: -50.9192 };
const JATAI = { lat: -17.8814, lng: -51.7144 };
const UBERLANDIA = { lat: -18.9186, lng: -48.2772 };
const UBERABA = { lat: -19.7472, lng: -47.9381 };
const ACREUNA = { lat: -17.396, lng: -50.3748 };
const BRASILIA = { lat: -15.7939, lng: -47.8828 };

describe('geo', () => {
  it('distância Rio Verde → Uberlândia em linha reta fica perto de 310 km', () => {
    const d = distanciaKm(RIO_VERDE, UBERLANDIA);
    expect(d).toBeGreaterThan(290);
    expect(d).toBeLessThan(330);
  });

  it('reconhece coordenada fora do Brasil (ex.: sinais trocados)', () => {
    expect(noBrasil(RIO_VERDE)).toBe(true);
    expect(noBrasil({ lat: 17.79, lng: 50.92 })).toBe(false);
  });

  it('recusa distância rodoviária menor que a linha reta ou exagerada', () => {
    expect(validarDistanciaRodoviaria(430, RIO_VERDE, UBERLANDIA)).toBeNull();
    expect(validarDistanciaRodoviaria(200, RIO_VERDE, UBERLANDIA)).toMatch(/linha reta/);
    expect(validarDistanciaRodoviaria(1500, RIO_VERDE, UBERLANDIA)).toMatch(/3 vezes/);
  });
});

describe('status do frete', () => {
  it('motorista conduz o frete até a entrega', () => {
    expect(podeTransitar('ACEITO', 'EM_COLETA', 'MOTORISTA')).toBe(true);
    expect(podeTransitar('EM_COLETA', 'EM_TRANSITO', 'MOTORISTA')).toBe(true);
    expect(podeTransitar('EM_TRANSITO', 'ENTREGUE', 'MOTORISTA')).toBe(true);
  });

  it('embarcador não marca coleta nem entrega pelo motorista', () => {
    expect(podeTransitar('ACEITO', 'EM_COLETA', 'EMBARCADOR')).toBe(false);
    expect(podeTransitar('EM_TRANSITO', 'ENTREGUE', 'EMBARCADOR')).toBe(false);
  });

  it('cancelamento: embarcador antes do transporte; motorista só na coleta; ninguém em trânsito', () => {
    expect(podeTransitar('PUBLICADO', 'CANCELADO', 'EMBARCADOR')).toBe(true);
    expect(podeTransitar('ACEITO', 'CANCELADO', 'MOTORISTA')).toBe(false);
    expect(podeTransitar('EM_COLETA', 'CANCELADO', 'MOTORISTA')).toBe(true);
    expect(podeTransitar('EM_TRANSITO', 'CANCELADO', 'ADMIN')).toBe(false);
  });

  it('não pula etapas nem volta de estados finais', () => {
    expect(podeTransitar('ACEITO', 'EM_TRANSITO', 'MOTORISTA')).toBe(false);
    expect(podeTransitar('ENTREGUE', 'EM_TRANSITO', 'ADMIN')).toBe(false);
    expect(podeTransitar('CANCELADO', 'PUBLICADO', 'ADMIN')).toBe(false);
  });
});

describe('matching', () => {
  const agora = new Date('2026-11-20T10:00:00Z');
  const frete: FreteParaMatching = {
    origemLat: RIO_VERDE.lat,
    origemLng: RIO_VERDE.lng,
    destinoLat: UBERLANDIA.lat,
    destinoLng: UBERLANDIA.lng,
    eixos: 5,
    carroceria: 'GRANELEIRO',
    coletaFim: new Date('2026-11-21T10:00:00Z'),
  };

  let n = 0;
  function motorista(posicao: { lat: number; lng: number }, extra: Partial<CandidatoBruto> & { destino?: { lat: number; lng: number }; veiculo?: Partial<Veiculo>; posicaoEm?: Date } = {}): CandidatoBruto {
    const id = `t${++n}`;
    return {
      transportador: { id, statusVerificacao: 'APROVADO' } as Transportador,
      veiculos: [{ id: `v${n}`, ativo: true, eixos: 5, carroceria: 'GRANELEIRO', ...extra.veiculo } as Veiculo],
      disponibilidade: {
        transportadorId: id,
        disponivel: true,
        lat: posicao.lat,
        lng: posicao.lng,
        destinoNome: null,
        destinoLat: extra.destino?.lat ?? null,
        destinoLng: extra.destino?.lng ?? null,
        atualizadoEm: extra.posicaoEm ?? agora,
      } as Disponibilidade,
      ocupado: false,
      ...extra,
    };
  }

  it('coloca quem está voltando para o destino na frente, depois o mais perto', () => {
    const perto = motorista(RIO_VERDE);
    const jatai = motorista(JATAI);
    const voltando = motorista(ACREUNA, { destino: UBERABA });
    const r = candidatosParaFrete(frete, [perto, jatai, voltando], agora);
    expect(r.map((c) => c.transportadorId)).toEqual([voltando.transportador.id, perto.transportador.id, jatai.transportador.id]);
    expect(r[0].retorno).toBe(true);
    expect(r[1].kmAteOrigem).toBe(0);
  });

  it('exclui quem não está apto, ocupado, longe, sem veículo compatível ou com posição velha', () => {
    const r = candidatosParaFrete(
      frete,
      [
        motorista(RIO_VERDE, { transportador: { id: 'pendente', statusVerificacao: 'PENDENTE' } as Transportador }),
        motorista(RIO_VERDE, { ocupado: true }),
        motorista(BRASILIA),
        motorista(RIO_VERDE, { veiculo: { eixos: 6 } }),
        motorista(RIO_VERDE, { veiculo: { carroceria: 'BASCULANTE' } }),
        motorista(RIO_VERDE, { veiculo: { ativo: false } }),
        motorista(RIO_VERDE, { posicaoEm: new Date(agora.getTime() - VALIDADE_POSICAO_MS - 1) }),
        motorista(RIO_VERDE, { disponibilidade: null }),
      ],
      agora,
    );
    expect(r).toEqual([]);
  });

  it('não oferece frete com janela de coleta vencida', () => {
    expect(candidatosParaFrete({ ...frete, coletaFim: agora }, [motorista(RIO_VERDE)], agora)).toEqual([]);
  });
});
