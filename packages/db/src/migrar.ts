import { conectar, migrar } from './index';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL.');
  const { db, pool } = conectar(url);
  await migrar(db);
  await pool.end();
  console.log('Migrações aplicadas.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
