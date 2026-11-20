import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { StatusFrete, Usuario } from '@fortex/db';
import { RELOGIO, Relogio } from '../auth/config';
import { Papeis, UsuarioAtual } from '../auth/decoradores';
import { Erros, texto } from '../cadastro/entrada';
import { lerFrete, local } from './entrada';
import { noBrasil } from './geo';
import { FretesService } from './fretes.service';

const PARA_PERMITIDOS: StatusFrete[] = ['PUBLICADO', 'EM_COLETA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO'];

@Controller()
export class FretesController {
  constructor(
    private readonly service: FretesService,
    @Inject(RELOGIO) private readonly agora: Relogio,
  ) {}

  @Papeis('EMBARCADOR')
  @Post('fretes')
  publicar(@UsuarioAtual() u: Usuario, @Body() body: Record<string, unknown>) {
    return this.service.publicar(u, lerFrete(body, this.agora()));
  }

  @Papeis('EMBARCADOR', 'MOTORISTA', 'ADMIN')
  @Get('fretes')
  listar(@UsuarioAtual() u: Usuario) {
    return this.service.listar(u);
  }

  @Get('fretes/:id')
  obter(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.obter(u, id);
  }

  @Papeis('MOTORISTA')
  @Post('fretes/:id/aceitar')
  @HttpCode(200)
  aceitar(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.aceitar(u, id);
  }

  /** Avança, devolve (desistência) ou cancela. Quem pode o quê está em status.ts. */
  @Papeis('EMBARCADOR', 'MOTORISTA', 'ADMIN')
  @Post('fretes/:id/status')
  @HttpCode(200)
  transitar(@UsuarioAtual() u: Usuario, @Param('id', ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const para = body?.para as StatusFrete;
    if (!PARA_PERMITIDOS.includes(para)) erros.add('para', `Use ${PARA_PERMITIDOS.join(', ')}.`);
    const motivo = texto(body, 'motivo', erros, true);
    erros.lancarSeHouver();
    return this.service.transitar(u, id, para, motivo);
  }

  @Papeis('MOTORISTA')
  @Put('motorista/disponibilidade')
  disponibilidade(@UsuarioAtual() u: Usuario, @Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const disponivel = body?.disponivel;
    if (typeof disponivel !== 'boolean') erros.add('disponivel', 'true ou false.');
    const p = body?.posicao as { lat?: unknown; lng?: unknown } | undefined;
    const posicao =
      p && typeof p.lat === 'number' && typeof p.lng === 'number' && noBrasil({ lat: p.lat, lng: p.lng })
        ? { lat: p.lat, lng: p.lng }
        : undefined;
    if (!posicao) erros.add('posicao', 'Informe lat e lng dentro do Brasil.');
    const destino = body?.destino === undefined || body.destino === null ? null : local(body, 'destino', erros);
    erros.lancarSeHouver();
    return this.service.atualizarDisponibilidade(u, { disponivel: disponivel as boolean, posicao: posicao!, destino: destino ?? null });
  }

  @Papeis('MOTORISTA')
  @Get('motorista/ofertas')
  ofertas(@UsuarioAtual() u: Usuario) {
    return this.service.ofertas(u);
  }
}
