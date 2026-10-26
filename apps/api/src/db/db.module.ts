import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { conectar } from '@fortex/db';
import type { Pool } from 'pg';
import { DB } from './tokens';

const POOL = Symbol('POOL');

@Global()
@Module({
  providers: [
    {
      provide: POOL,
      useFactory: () => conectar(process.env.DATABASE_URL ?? 'postgresql://fortex:fortex@localhost:5432/fortex'),
    },
    { provide: DB, useFactory: (c: ReturnType<typeof conectar>) => c.db, inject: [POOL] },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly conexao: { pool: Pool }) {}

  async onApplicationShutdown() {
    await this.conexao.pool.end();
  }
}
