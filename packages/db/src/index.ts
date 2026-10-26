import path from 'node:path';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema';

export * from './schema';
export { schema };

/** Qualquer banco Drizzle com o esquema do Fortex (node-postgres em produção, PGlite em teste). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Pasta das migrações SQL geradas pelo drizzle-kit. */
export const PASTA_MIGRACOES = path.join(__dirname, '..', 'migrations');

export function conectar(url: string): { db: NodePgDatabase<typeof schema>; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}

export async function migrar(db: NodePgDatabase<typeof schema>): Promise<void> {
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
}
