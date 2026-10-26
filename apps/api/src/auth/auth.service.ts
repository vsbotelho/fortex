import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { codigosAcesso, Db, sessoes, Usuario, usuarios } from '@fortex/db';
import { DB } from '../db/tokens';
import { AUTH_CONFIG, AuthConfig, ENVIADOR_CODIGO, EnviadorCodigo, RELOGIO, Relogio } from './config';

export interface SessaoCriada {
  token: string;
  expiraEm: Date;
  usuario: Usuario;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const INVALIDO = 'Código inválido ou expirado.';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AUTH_CONFIG) private readonly cfg: AuthConfig,
    @Inject(ENVIADOR_CODIGO) private readonly enviador: EnviadorCodigo,
    @Inject(RELOGIO) private readonly agora: Relogio,
  ) {}

  private hashCodigo(telefone: string, codigo: string) {
    return createHmac('sha256', this.cfg.segredo).update(`${telefone}:${codigo}`).digest('hex');
  }

  /** Gera e envia um código de 6 dígitos. A resposta é a mesma exista ou não conta. */
  async pedirCodigo(telefone: string): Promise<void> {
    const agora = this.agora();
    const inicioJanela = new Date(agora.getTime() - this.cfg.janelaCodigosMs);
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(codigosAcesso)
      .where(and(eq(codigosAcesso.telefone, telefone), gt(codigosAcesso.criadoEm, inicioJanela)));
    if (total >= this.cfg.maxCodigosPorJanela) {
      throw new HttpException(
        { codigo: 'MUITOS_PEDIDOS', mensagem: 'Muitos códigos pedidos. Aguarde alguns minutos.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.insert(codigosAcesso).values({
      telefone,
      hash: this.hashCodigo(telefone, codigo),
      expiraEm: new Date(agora.getTime() + this.cfg.validadeCodigoMs),
      criadoEm: agora,
    });
    await this.enviador.enviar(telefone, codigo);
  }

  /** Confere o código mais recente e abre uma sessão. Cria o usuário no primeiro acesso. */
  async entrar(telefone: string, codigo: string): Promise<SessaoCriada> {
    const agora = this.agora();
    const [registro] = await this.db
      .select()
      .from(codigosAcesso)
      .where(and(eq(codigosAcesso.telefone, telefone), isNull(codigosAcesso.usadoEm), gt(codigosAcesso.expiraEm, agora)))
      .orderBy(desc(codigosAcesso.criadoEm))
      .limit(1);
    if (!registro) throw new UnauthorizedException({ codigo: 'CODIGO_INVALIDO', mensagem: INVALIDO });

    const [{ tentativas }] = await this.db
      .update(codigosAcesso)
      .set({ tentativas: sql`${codigosAcesso.tentativas} + 1` })
      .where(eq(codigosAcesso.id, registro.id))
      .returning({ tentativas: codigosAcesso.tentativas });
    if (tentativas > this.cfg.maxTentativasPorCodigo) {
      throw new UnauthorizedException({ codigo: 'MUITAS_TENTATIVAS', mensagem: 'Muitas tentativas. Peça um novo código.' });
    }

    const esperado = Buffer.from(registro.hash, 'hex');
    const recebido = Buffer.from(this.hashCodigo(telefone, String(codigo)), 'hex');
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
      throw new UnauthorizedException({ codigo: 'CODIGO_INVALIDO', mensagem: INVALIDO });
    }

    // Marca como usado só se ninguém usou antes (evita corrida com duas requisições).
    const usados = await this.db
      .update(codigosAcesso)
      .set({ usadoEm: agora })
      .where(and(eq(codigosAcesso.id, registro.id), isNull(codigosAcesso.usadoEm)))
      .returning({ id: codigosAcesso.id });
    if (usados.length === 0) throw new UnauthorizedException({ codigo: 'CODIGO_INVALIDO', mensagem: INVALIDO });

    await this.db.insert(usuarios).values({ telefone }).onConflictDoNothing({ target: usuarios.telefone });
    const [usuario] = await this.db
      .update(usuarios)
      .set({ ultimoAcessoEm: agora })
      .where(eq(usuarios.telefone, telefone))
      .returning();

    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(agora.getTime() + this.cfg.validadeSessaoMs);
    await this.db.insert(sessoes).values({ usuarioId: usuario.id, hashToken: sha256(token), expiraEm, criadoEm: agora });
    return { token, expiraEm, usuario };
  }

  /** Devolve o usuário dono de um token válido, ou null. */
  async autenticar(token: string): Promise<Usuario | null> {
    if (!token || token.length > 100) return null;
    const [linha] = await this.db
      .select({ usuario: usuarios })
      .from(sessoes)
      .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
      .where(and(eq(sessoes.hashToken, sha256(token)), isNull(sessoes.revogadaEm), gt(sessoes.expiraEm, this.agora())))
      .limit(1);
    return linha?.usuario ?? null;
  }

  async sair(token: string): Promise<void> {
    await this.db
      .update(sessoes)
      .set({ revogadaEm: this.agora() })
      .where(and(eq(sessoes.hashToken, sha256(token)), isNull(sessoes.revogadaEm)));
  }
}
