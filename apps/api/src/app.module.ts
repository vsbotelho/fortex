import { Module, Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TABELA_VIGENTE } from '@fortex/pricing';
import { HealthController } from './health.controller';
import { CotacaoController } from './cotacao/cotacao.controller';
import { CotacaoService } from './cotacao/cotacao.service';
import { TABELA_PISO } from './cotacao/tokens';
import { CadastroController } from './cadastro/cadastro.controller';
import { AdminController } from './cadastro/admin.controller';
import { CadastroService } from './cadastro/cadastro.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AUTH_CONFIG, configDoAmbiente, ENVIADOR_CODIGO, EnviadorConsole, RELOGIO } from './auth/config';
import { DbModule } from './db/db.module';

export const CONTROLADORES = [HealthController, AuthController, CotacaoController, CadastroController, AdminController];

/** Provedores da aplicação. Os testes substituem DB, envio de código e relógio. */
export const PROVEDORES: Provider[] = [
  CotacaoService,
  CadastroService,
  AuthService,
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: TABELA_PISO, useValue: TABELA_VIGENTE },
  { provide: AUTH_CONFIG, useFactory: () => configDoAmbiente() },
  // PENDENTE: trocar pelo provedor de SMS/WhatsApp escolhido.
  { provide: ENVIADOR_CODIGO, useFactory: () => new EnviadorConsole() },
  { provide: RELOGIO, useValue: () => new Date() },
];

@Module({
  imports: [DbModule],
  controllers: CONTROLADORES,
  providers: PROVEDORES,
})
export class AppModule {}
