import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { Usuario } from '@fortex/db';
import {
  normalizarCnh,
  normalizarCnpj,
  normalizarCpf,
  normalizarPlaca,
  normalizarRenavam,
  normalizarRntrc,
} from '@fortex/validacao';
import { Papeis, UsuarioAtual } from '../auth/decoradores';
import { CadastroService } from './cadastro.service';
import { documento, email, Erros, texto } from './entrada';

const EIXOS = [2, 3, 4, 5, 6, 7, 9];
const CARROCERIAS = ['GRANELEIRO', 'BASCULANTE'] as const;

/** Cadastro feito pelo próprio usuário logado; o telefone vem do login. */
@Controller()
export class CadastroController {
  constructor(private readonly service: CadastroService) {}

  @Papeis('NOVO')
  @Post('transportadores')
  criarTransportador(@UsuarioAtual() u: Usuario, @Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const tipo = body?.tipo;
    if (tipo !== 'TAC' && tipo !== 'ETC') erros.add('tipo', 'Use TAC ou ETC.');
    const doc =
      tipo === 'ETC'
        ? documento(body, 'documento', normalizarCnpj, 'CNPJ inválido.', erros)
        : documento(body, 'documento', normalizarCpf, 'CPF inválido.', erros);
    const dados = {
      tipo: tipo as 'TAC' | 'ETC',
      documento: doc!,
      nome: texto(body, 'nome', erros)!,
      rntrc: documento(body, 'rntrc', normalizarRntrc, 'RNTRC deve ter 8 ou 9 dígitos.', erros)!,
      cnh: documento(body, 'cnh', normalizarCnh, 'CNH deve ter 11 dígitos.', erros, tipo !== 'TAC') ?? null,
      email: email(body, 'email', erros, true) ?? null,
    };
    erros.lancarSeHouver();
    return this.service.criarTransportador(u, dados);
  }

  @Get('transportadores/:id')
  obterTransportador(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obterTransportador(u, id);
  }

  @Papeis('MOTORISTA', 'ADMIN')
  @Post('transportadores/:id/veiculos')
  adicionarVeiculo(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const eixos = body?.eixos;
    if (typeof eixos !== 'number' || !EIXOS.includes(eixos)) erros.add('eixos', 'Use 2, 3, 4, 5, 6, 7 ou 9 eixos.');
    const carroceria = body?.carroceria;
    if (!CARROCERIAS.includes(carroceria as (typeof CARROCERIAS)[number])) {
      erros.add('carroceria', 'No MVP de grãos: GRANELEIRO ou BASCULANTE.');
    }
    const dados = {
      placa: documento(body, 'placa', normalizarPlaca, 'Placa inválida.', erros)!,
      renavam: documento(body, 'renavam', normalizarRenavam, 'RENAVAM inválido.', erros)!,
      eixos: eixos as number,
      carroceria: carroceria as (typeof CARROCERIAS)[number],
    };
    erros.lancarSeHouver();
    return this.service.adicionarVeiculo(u, id, dados);
  }

  @Papeis('NOVO')
  @Post('embarcadores')
  criarEmbarcador(@UsuarioAtual() u: Usuario, @Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const bruto = typeof body?.documento === 'string' ? body.documento.replace(/[^0-9A-Za-z]/g, '') : '';
    const doc =
      bruto.length === 11
        ? documento(body, 'documento', normalizarCpf, 'CPF inválido.', erros)
        : documento(body, 'documento', normalizarCnpj, 'CNPJ ou CPF inválido.', erros);
    const dados = {
      documento: doc!,
      nome: texto(body, 'nome', erros)!,
      email: email(body, 'email', erros)!,
    };
    erros.lancarSeHouver();
    return this.service.criarEmbarcador(u, dados);
  }

  @Get('embarcadores/:id')
  obterEmbarcador(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obterEmbarcador(u, id);
  }
}
