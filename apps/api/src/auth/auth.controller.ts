import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import type { Usuario } from '@fortex/db';
import { Erros, telefone } from '../cadastro/entrada';
import { AuthService } from './auth.service';
import { extrairToken, Publico, UsuarioAtual } from './decoradores';

function publicoDoUsuario(u: Usuario) {
  return { id: u.id, telefone: u.telefone, papel: u.papel, transportadorId: u.transportadorId, embarcadorId: u.embarcadorId };
}

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('auth/codigo')
  @HttpCode(202)
  async pedirCodigo(@Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const tel = telefone(body, 'telefone', erros);
    erros.lancarSeHouver();
    await this.auth.pedirCodigo(tel!);
    return { enviado: true };
  }

  @Publico()
  @Post('auth/entrar')
  @HttpCode(200)
  async entrar(@Body() body: Record<string, unknown>) {
    const erros = new Erros();
    const tel = telefone(body, 'telefone', erros);
    const codigo = body?.codigo;
    if (typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) erros.add('codigo', 'Informe os 6 dígitos.');
    erros.lancarSeHouver();
    const s = await this.auth.entrar(tel!, codigo as string);
    return { token: s.token, expiraEm: s.expiraEm, usuario: publicoDoUsuario(s.usuario) };
  }

  @Post('auth/sair')
  @HttpCode(204)
  async sair(@Headers('authorization') cabecalho: string | undefined) {
    const token = extrairToken(cabecalho);
    if (!token) throw new BadRequestException();
    await this.auth.sair(token);
  }

  @Get('eu')
  eu(@UsuarioAtual() u: Usuario) {
    return publicoDoUsuario(u);
  }
}
