import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PapelUsuario, Usuario } from '@fortex/db';

export const CHAVE_PUBLICO = 'fortex:publico';
export const CHAVE_PAPEIS = 'fortex:papeis';

/** Rota acessível sem login. */
export const Publico = () => SetMetadata(CHAVE_PUBLICO, true);

/** Restringe a rota a estes papéis. */
export const Papeis = (...papeis: PapelUsuario[]) => SetMetadata(CHAVE_PAPEIS, papeis);

/** Usuário logado da requisição. */
export const UsuarioAtual = createParamDecorator((_: unknown, ctx: ExecutionContext): Usuario => {
  return ctx.switchToHttp().getRequest().usuario;
});

export function extrairToken(cabecalho: string | undefined): string | null {
  if (!cabecalho) return null;
  const [tipo, token] = cabecalho.split(' ');
  return tipo === 'Bearer' && token ? token : null;
}
