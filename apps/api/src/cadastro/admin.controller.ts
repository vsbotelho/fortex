import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { Usuario } from '@fortex/db';
import { Papeis, UsuarioAtual } from '../auth/decoradores';
import { CadastroService, Decisao } from './cadastro.service';
import { Erros, texto } from './entrada';

const DECISOES: Decisao[] = ['EM_ANALISE', 'APROVADO', 'REPROVADO'];

function lerDecisao(body: Record<string, unknown>) {
  const erros = new Erros();
  const decisao = body?.decisao as Decisao;
  if (!DECISOES.includes(decisao)) erros.add('decisao', 'Use EM_ANALISE, APROVADO ou REPROVADO.');
  const motivo = texto(body, 'motivo', erros, decisao !== 'REPROVADO');
  erros.lancarSeHouver();
  return { decisao, motivo };
}

/** Painel de verificação de cadastros. */
@Papeis('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: CadastroService) {}

  @Get('cadastros/pendentes')
  pendentes() {
    return this.service.pendentes();
  }

  @Post('transportadores/:id/verificacao')
  @HttpCode(200)
  decidirTransportador(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    const { decisao, motivo } = lerDecisao(body);
    return this.service.decidir(u, 'transportador', id, decisao, motivo);
  }

  @Post('embarcadores/:id/verificacao')
  @HttpCode(200)
  decidirEmbarcador(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    const { decisao, motivo } = lerDecisao(body);
    return this.service.decidir(u, 'embarcador', id, decisao, motivo);
  }
}
