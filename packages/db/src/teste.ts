import { PGlite } from '@electric-sql/pglite';
import { drizzle, PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { PASTA_MIGRACOES } from './index';
import * as schema from './schema';

/**
 * Banco PostgreSQL em memória (PGlite) com as migrações aplicadas.
 * Só para testes: importe de '@fortex/db/dist/teste'.
 */
export async function bancoDeTeste(): Promise<{ db: PgliteDatabase<typeof schema>; fechar: () => Promise<void> }> {
  const cliente = new PGlite();
  const db = drizzle(cliente, { schema });
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
  return { db, fechar: () => cliente.close() };
}
