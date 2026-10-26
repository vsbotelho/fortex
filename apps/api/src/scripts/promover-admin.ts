/**
 * Promove um usuário a ADMIN. Uso:
 *   DATABASE_URL=... pnpm --filter @fortex/api admin:promover +5564999990000
 * O usuário precisa ter entrado ao menos uma vez e não ter cadastro de
 * transportador ou embarcador.
 */
import { and, eq } from 'drizzle-orm';
import { auditoria, conectar, usuarios } from '@fortex/db';

async function main() {
  const telefone = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!url || !telefone) throw new Error('Uso: DATABASE_URL=... admin:promover +55DDDNUMERO');
  const { db, pool } = conectar(url);
  const r = await db
    .update(usuarios)
    .set({ papel: 'ADMIN' })
    .where(and(eq(usuarios.telefone, telefone), eq(usuarios.papel, 'NOVO')))
    .returning({ id: usuarios.id });
  if (r.length === 0) throw new Error('Usuário não encontrado ou já tem outro papel.');
  await db.insert(auditoria).values({ acao: 'PROMOVER_ADMIN', entidade: 'usuario', entidadeId: r[0].id, dados: { telefone, via: 'script' } });
  await pool.end();
  console.log(`${telefone} agora é ADMIN.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
