import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelUsuario } from '@fortex/db';
import { AuthService } from './auth.service';
import { CHAVE_PAPEIS, CHAVE_PUBLICO, extrairToken } from './decoradores';

/** Guard global: toda rota exige login, salvo as marcadas com @Publico(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CHAVE_PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = extrairToken(req.headers?.authorization);
    const usuario = token ? await this.auth.autenticar(token) : null;
    if (!usuario) throw new UnauthorizedException({ codigo: 'NAO_AUTENTICADO', mensagem: 'Faça login para continuar.' });
    req.usuario = usuario;

    const papeis = this.reflector.getAllAndOverride<PapelUsuario[]>(CHAVE_PAPEIS, alvos);
    if (papeis?.length && !papeis.includes(usuario.papel)) {
      throw new ForbiddenException({ codigo: 'SEM_PERMISSAO', mensagem: 'Seu perfil não tem acesso a esta área.' });
    }
    return true;
  }
}
