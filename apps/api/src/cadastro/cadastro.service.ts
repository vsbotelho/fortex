import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Db, Embarcador, embarcadores, NovoEmbarcador, NovoTransportador, NovoVeiculo, Transportador, transportadores, Veiculo, veiculos } from '@fortex/db';
import { DB } from '../db/tokens';
import { avaliarElegibilidade, Elegibilidade } from './elegibilidade';
import { violacaoUnica } from './entrada';

export interface TransportadorDetalhado extends Transportador {
  veiculos: Veiculo[];
  elegibilidade: Elegibilidade;
}

const MENSAGEM_DUPLICADO: Record<string, string> = {
  transportadores_documento_unique: 'Já existe transportador com este CPF/CNPJ.',
  transportadores_rntrc_unique: 'Já existe transportador com este RNTRC.',
  veiculos_placa_unique: 'Já existe veículo com esta placa.',
  veiculos_renavam_unique: 'Já existe veículo com este RENAVAM.',
  embarcadores_documento_unique: 'Já existe embarcador com este CPF/CNPJ.',
};

function traduzirDuplicidade(e: unknown): never {
  const chave = violacaoUnica(e);
  if (chave) {
    throw new ConflictException({ codigo: 'DUPLICADO', mensagem: MENSAGEM_DUPLICADO[chave] ?? 'Registro duplicado.' });
  }
  throw e;
}

@Injectable()
export class CadastroService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async criarTransportador(dados: NovoTransportador): Promise<TransportadorDetalhado> {
    try {
      const [t] = await this.db.insert(transportadores).values(dados).returning();
      return { ...t, veiculos: [], elegibilidade: avaliarElegibilidade(t, []) };
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  async obterTransportador(id: string): Promise<TransportadorDetalhado> {
    const [t] = await this.db.select().from(transportadores).where(eq(transportadores.id, id));
    if (!t) throw new NotFoundException('Transportador não encontrado.');
    const vs = await this.db.select().from(veiculos).where(eq(veiculos.transportadorId, id));
    return { ...t, veiculos: vs, elegibilidade: avaliarElegibilidade(t, vs) };
  }

  async adicionarVeiculo(transportadorId: string, dados: Omit<NovoVeiculo, 'transportadorId'>): Promise<Veiculo> {
    await this.obterTransportador(transportadorId);
    try {
      const [v] = await this.db.insert(veiculos).values({ ...dados, transportadorId }).returning();
      return v;
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  async criarEmbarcador(dados: NovoEmbarcador): Promise<Embarcador> {
    try {
      const [e] = await this.db.insert(embarcadores).values(dados).returning();
      return e;
    } catch (e) {
      traduzirDuplicidade(e);
    }
  }

  async obterEmbarcador(id: string): Promise<Embarcador> {
    const [e] = await this.db.select().from(embarcadores).where(eq(embarcadores.id, id));
    if (!e) throw new NotFoundException('Embarcador não encontrado.');
    return e;
  }
}
