import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CotacaoController } from './cotacao/cotacao.controller';
import { CotacaoService } from './cotacao/cotacao.service';
import { TABELA_PISO } from './cotacao/tokens';
import { TABELA_VIGENTE } from '@fortex/pricing';

@Module({
  controllers: [HealthController, CotacaoController],
  providers: [CotacaoService, { provide: TABELA_PISO, useValue: TABELA_VIGENTE }],
})
export class AppModule {}
