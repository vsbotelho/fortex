import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import {
  Db,
  disponibilidades,
  embarcadores,
  Frete,
  freteEventos,
  fretes,
  StatusFrete,
  transportadores,
  Usuario,
  veiculos,
} from '@fortex/db';
import { TipoCarga } from '@fortex/pricing';
import { RELOGIO, Relogio } from '../auth/config';
import { violacaoUnica } from '../cadastro/entrada';
import { avaliarElegibilidade } from '../cadastro/elegibilidade';
import { CotacaoService } from '../cotacao/cotacao.service';
import { DB } from '../db/tokens';
import { DadosFrete, Local } from './entrada';
import { validarDistanciaRodoviaria } from './geo';
import { Candidato, CandidatoBruto, candidatosParaFrete, RAIO_COLETA_KM } from './matching';
import { MAX_AVISADOS, NOTIFICADOR_FRETES, NotificadorFretes } from './notificador';
import { Ator, podeTransitar, STATUS_ATIVOS } from './status';

export interface DadosDisponibilidade {
  disponivel: boolean;
  posicao: { lat: number; lng: number };
  destino: Local | null;
}

/** Graus de latitude/longitude que cobrem o raio de coleta com folga (pré-filtro). */
const MARGEM_GRAUS = RAIO_COLETA_KM / 90;

const proibido = () => new ForbiddenException({ codigo: 'SEM_PERMISSAO', mensagem: 'Sem acesso a este frete.' });

@Injectable()
export class FretesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(RELOGIO) private readonly agora: Relogio,
    @Inject(NOTIFICADOR_FRETES) private readonly notificador: NotificadorFretes,
    private readonly cotacao: CotacaoService,
  ) {}

  /** Publica o frete com a cotação congelada e avisa os motoristas compatíveis. */
  async publicar(u: Usuario, dados: DadosFrete) {
    const [embarcador] = await this.db.select().from(embarcadores).where(eq(embarcadores.id, u.embarcadorId!));
    if (embarcador?.statusVerificacao !== 'APROVADO') {
      throw new ForbiddenException({
        codigo: 'EMBARCADOR_NAO_APROVADO',
        mensagem: 'Seu cadastro precisa estar aprovado para publicar fretes.',
      });
    }

    const erroDistancia = validarDistanciaRodoviaria(dados.distanciaKm, dados.origem, dados.destino);
    if (erroDistancia) {
      throw new BadRequestException({ codigo: 'DADOS_INVALIDOS', campos: { distanciaKm: erroDistancia } });
    }

    // Lança 422 ABAIXO_DO_PISO se o valor proposto não respeitar o piso.
    const { piso, cotacao } = this.cotacao.cotar({
      tipoCarga: TipoCarga.GRANEL_SOLIDO,
      eixos: dados.eixos,
      distanciaKm: dados.distanciaKm,
      frete: dados.freteCentavos,
      valePedagio: dados.valePedagioCentavos,
      adiantamentoPercentual: dados.adiantamentoPercentual,
    });

    const frete = await this.db.transaction(async (tx) => {
      const [novo] = await tx
        .insert(fretes)
        .values({
          embarcadorId: embarcador.id,
          origemNome: dados.origem.nome,
          origemLat: dados.origem.lat,
          origemLng: dados.origem.lng,
          destinoNome: dados.destino.nome,
          destinoLat: dados.destino.lat,
          destinoLng: dados.destino.lng,
          distanciaKm: dados.distanciaKm,
          tipoCarga: dados.tipoCarga,
          produto: dados.produto,
          pesoKg: dados.pesoKg,
          eixos: dados.eixos,
          carroceria: dados.carroceria,
          coletaInicio: dados.coletaInicio,
          coletaFim: dados.coletaFim,
          observacoes: dados.observacoes,
          pisoCentavos: piso.valor,
          normaPiso: piso.norma,
          freteCentavos: cotacao.freteTransportador,
          adiantamentoPercentual: dados.adiantamentoPercentual,
          adiantamentoCentavos: cotacao.adiantamentoColeta,
          saldoCentavos: cotacao.saldoEntrega,
          valePedagioCentavos: cotacao.valePedagio,
          taxaFortexCentavos: cotacao.taxaFortex,
        })
        .returning();
      await tx.insert(freteEventos).values({ freteId: novo.id, de: null, para: 'PUBLICADO', usuarioId: u.id });
      return novo;
    });

    const candidatos = await this.candidatos(frete);
    await this.notificador.novoFrete(frete, candidatos.slice(0, MAX_AVISADOS));
    return { ...frete, motoristasCompativeis: candidatos.length };
  }

  /** Motoristas aptos para o frete, já ordenados. */
  async candidatos(frete: Frete): Promise<Candidato[]> {
    const brutos = await this.carregarCandidatos({
      latMin: frete.origemLat - MARGEM_GRAUS,
      latMax: frete.origemLat + MARGEM_GRAUS,
    });
    return candidatosParaFrete(frete, brutos, this.agora());
  }

  /** Motoristas disponíveis numa faixa de latitude, com veículos e se estão ocupados. */
  private async carregarCandidatos(faixa: { latMin: number; latMax: number }, transportadorId?: string): Promise<CandidatoBruto[]> {
    const linhas = await this.db
      .select({ transportador: transportadores, disponibilidade: disponibilidades })
      .from(disponibilidades)
      .innerJoin(transportadores, eq(transportadores.id, disponibilidades.transportadorId))
      .where(
        and(
          eq(disponibilidades.disponivel, true),
          eq(transportadores.statusVerificacao, 'APROVADO'),
          transportadorId ? eq(transportadores.id, transportadorId) : undefined,
        ),
      );
    const naFaixa = linhas.filter((l) => l.disponibilidade.lat >= faixa.latMin && l.disponibilidade.lat <= faixa.latMax);
    if (naFaixa.length === 0) return [];

    const ids = naFaixa.map((l) => l.transportador.id);
    const [vs, ativos] = await Promise.all([
      this.db.select().from(veiculos).where(inArray(veiculos.transportadorId, ids)),
      this.db
        .select({ transportadorId: fretes.transportadorId })
        .from(fretes)
        .where(and(inArray(fretes.transportadorId, ids), inArray(fretes.status, STATUS_ATIVOS))),
    ]);
    const ocupados = new Set(ativos.map((a) => a.transportadorId));
    return naFaixa.map((l) => ({
      transportador: l.transportador,
      disponibilidade: l.disponibilidade,
      veiculos: vs.filter((v) => v.transportadorId === l.transportador.id),
      ocupado: ocupados.has(l.transportador.id),
    }));
  }

  async listar(u: Usuario) {
    if (u.papel === 'EMBARCADOR') {
      return this.db.select().from(fretes).where(eq(fretes.embarcadorId, u.embarcadorId!)).orderBy(desc(fretes.criadoEm));
    }
    if (u.papel === 'MOTORISTA') {
      return this.db.select().from(fretes).where(eq(fretes.transportadorId, u.transportadorId!)).orderBy(desc(fretes.criadoEm));
    }
    if (u.papel === 'ADMIN') return this.db.select().from(fretes).orderBy(desc(fretes.criadoEm)).limit(200);
    throw proibido();
  }

  async obter(u: Usuario, id: string) {
    const frete = await this.buscar(id);
    const ator = this.atorNoFrete(u, frete);
    const vitrine = u.papel === 'MOTORISTA' && frete.status === 'PUBLICADO';
    if (!ator && !vitrine) throw proibido();

    const eventos = await this.db.select().from(freteEventos).where(eq(freteEventos.freteId, id)).orderBy(asc(freteEventos.criadoEm));
    let motorista = null;
    if (frete.transportadorId && ator) {
      const [linha] = await this.db
        .select({ nome: transportadores.nome, telefone: transportadores.telefone, placa: veiculos.placa })
        .from(transportadores)
        .innerJoin(veiculos, eq(veiculos.id, frete.veiculoId!))
        .where(eq(transportadores.id, frete.transportadorId));
      motorista = linha ?? null;
    }
    return { ...frete, motorista, eventos };
  }

  async atualizarDisponibilidade(u: Usuario, d: DadosDisponibilidade) {
    const valores = {
      disponivel: d.disponivel,
      lat: d.posicao.lat,
      lng: d.posicao.lng,
      destinoNome: d.destino?.nome ?? null,
      destinoLat: d.destino?.lat ?? null,
      destinoLng: d.destino?.lng ?? null,
      atualizadoEm: this.agora(),
    };
    const [r] = await this.db
      .insert(disponibilidades)
      .values({ transportadorId: u.transportadorId!, ...valores })
      .onConflictDoUpdate({ target: disponibilidades.transportadorId, set: valores })
      .returning();
    return r;
  }

  /** Fretes publicados que este motorista pode aceitar agora, na ordem do matching. */
  async ofertas(u: Usuario) {
    const tid = u.transportadorId!;
    const [t] = await this.db.select().from(transportadores).where(eq(transportadores.id, tid));
    const vs = await this.db.select().from(veiculos).where(eq(veiculos.transportadorId, tid));
    const { apto, pendencias } = avaliarElegibilidade(t, vs);
    const [disp] = await this.db.select().from(disponibilidades).where(eq(disponibilidades.transportadorId, tid));
    if (!disp?.disponivel) pendencias.push('Informe sua posição e marque-se como disponível.');
    if (!apto || !disp?.disponivel) return { apto: false, pendencias, ofertas: [] };

    const [eu] = await this.carregarCandidatos({ latMin: -90, latMax: 90 }, tid);
    if (!eu || eu.ocupado) {
      return { apto: false, pendencias: eu?.ocupado ? ['Você já tem um frete em andamento.'] : pendencias, ofertas: [] };
    }

    const abertos = await this.db
      .select()
      .from(fretes)
      .where(and(eq(fretes.status, 'PUBLICADO'), gt(fretes.coletaFim, this.agora())))
      .orderBy(asc(fretes.coletaInicio))
      .limit(500);
    const agora = this.agora();
    const ofertas = abertos
      .filter((f) => Math.abs(f.origemLat - disp.lat) <= MARGEM_GRAUS)
      .flatMap((f) => {
        const [c] = candidatosParaFrete(f, [eu], agora);
        return c ? [{ ...f, kmAteOrigem: c.kmAteOrigem, retorno: c.retorno, veiculoId: c.veiculoId }] : [];
      })
      .sort((a, b) => Number(b.retorno) - Number(a.retorno) || a.kmAteOrigem - b.kmAteOrigem);
    return { apto: true, pendencias: [], ofertas };
  }

  /** Aceite atômico: só o primeiro motorista compatível leva o frete. */
  async aceitar(u: Usuario, id: string) {
    const frete = await this.buscar(id);
    if (frete.status !== 'PUBLICADO') {
      throw new ConflictException({ codigo: 'FRETE_INDISPONIVEL', mensagem: 'Este frete não está mais disponível.' });
    }
    const [eu] = await this.carregarCandidatos({ latMin: -90, latMax: 90 }, u.transportadorId!);
    const [candidato] = eu ? candidatosParaFrete(frete, [eu], this.agora()) : [];
    if (!candidato) {
      throw new ForbiddenException({
        codigo: 'NAO_COMPATIVEL',
        mensagem: 'Você não atende a este frete agora (cadastro, veículo, disponibilidade ou distância até a coleta).',
      });
    }

    let aceito: Frete | undefined;
    try {
      aceito = await this.db.transaction(async (tx) => {
        const [f] = await tx
          .update(fretes)
          .set({
            status: 'ACEITO',
            transportadorId: candidato.transportadorId,
            veiculoId: candidato.veiculoId,
            aceitoEm: this.agora(),
            atualizadoEm: this.agora(),
          })
          .where(and(eq(fretes.id, id), eq(fretes.status, 'PUBLICADO')))
          .returning();
        if (!f) return undefined;
        await tx.update(disponibilidades).set({ disponivel: false }).where(eq(disponibilidades.transportadorId, candidato.transportadorId));
        await tx.insert(freteEventos).values({ freteId: id, de: 'PUBLICADO', para: 'ACEITO', usuarioId: u.id, dados: { veiculoId: candidato.veiculoId } });
        return f;
      });
    } catch (e) {
      if (violacaoUnica(e)) {
        throw new ConflictException({ codigo: 'JA_TEM_FRETE', mensagem: 'Você já tem um frete em andamento.' });
      }
      throw e;
    }
    if (!aceito) throw new ConflictException({ codigo: 'FRETE_INDISPONIVEL', mensagem: 'Outro motorista aceitou este frete antes.' });
    await this.notificador.freteAceito(aceito);
    return aceito;
  }

  async transitar(u: Usuario, id: string, para: StatusFrete, motivo?: string) {
    const frete = await this.buscar(id);
    const ator = this.atorNoFrete(u, frete);
    if (!ator) throw proibido();
    if (!podeTransitar(frete.status, para, ator)) {
      throw new ConflictException({
        codigo: 'TRANSICAO_INVALIDA',
        mensagem: `Não é possível passar de ${frete.status} para ${para} como ${ator.toLowerCase()}.`,
      });
    }
    if (para === 'CANCELADO' && !motivo) {
      throw new BadRequestException({ codigo: 'DADOS_INVALIDOS', campos: { motivo: 'Informe o motivo do cancelamento.' } });
    }

    const desistencia = frete.status === 'ACEITO' && para === 'PUBLICADO';
    const atualizado = await this.db.transaction(async (tx) => {
      const [f] = await tx
        .update(fretes)
        .set({
          status: para,
          atualizadoEm: this.agora(),
          ...(para === 'CANCELADO' ? { motivoCancelamento: motivo } : {}),
          ...(desistencia ? { transportadorId: null, veiculoId: null, aceitoEm: null } : {}),
        })
        .where(and(eq(fretes.id, id), eq(fretes.status, frete.status)))
        .returning();
      if (!f) return undefined;
      await tx.insert(freteEventos).values({
        freteId: id,
        de: frete.status,
        para,
        usuarioId: u.id,
        dados: motivo || desistencia ? { motivo: motivo ?? null, transportadorId: desistencia ? frete.transportadorId : undefined } : null,
      });
      return f;
    });
    if (!atualizado) {
      throw new ConflictException({ codigo: 'CONFLITO', mensagem: 'O frete mudou enquanto você agia. Atualize e tente de novo.' });
    }
    await this.notificador.statusAlterado(atualizado, frete.status);
    if (desistencia) await this.notificador.novoFrete(atualizado, (await this.candidatos(atualizado)).slice(0, MAX_AVISADOS));
    return atualizado;
  }

  private async buscar(id: string): Promise<Frete> {
    const [f] = await this.db.select().from(fretes).where(eq(fretes.id, id));
    if (!f) throw new NotFoundException('Frete não encontrado.');
    return f;
  }

  /** Papel do usuário neste frete específico, ou null se não tem relação com ele. */
  private atorNoFrete(u: Usuario, f: Frete): Ator | null {
    if (u.papel === 'ADMIN') return 'ADMIN';
    if (u.papel === 'EMBARCADOR' && u.embarcadorId === f.embarcadorId) return 'EMBARCADOR';
    if (u.papel === 'MOTORISTA' && f.transportadorId && u.transportadorId === f.transportadorId) return 'MOTORISTA';
    return null;
  }
}
