import { Module } from '@nestjs/common';
import { TABELA_VIGENTE } from '@fortex/pricing';
import { HealthController } from './health.controller';
import { CotacaoController } from './cotacao/cotacao.controller';
import { CotacaoService } from './cotacao/cotacao.service';
import { TABELA_PISO } from './cotacao/tokens';
import { CadastroController } from './cadastro/cadastro.controller';
import { CadastroService } from './cadastro/cadastro.service';
import { DbModule } from './db/db.module';

@Module({
  imports: [DbModule],
  controllers: [HealthController, CotacaoController, CadastroController],
  providers: [CotacaoService, CadastroService, { provide: TABELA_PISO, useValue: TABELA_VIGENTE }],
})
export class AppModule {}
