// Cria db/db.json (local, não versionado) a partir de db/db.seed.json.
// Uso: node scripts/ensure-db.mjs [--reset]   (--reset sobrescreve os dados locais)
import { copyFileSync, existsSync } from 'node:fs';

const seed = new URL('../db/db.seed.json', import.meta.url);
const db = new URL('../db/db.json', import.meta.url);
const reset = process.argv.includes('--reset');

if (reset || !existsSync(db)) {
  copyFileSync(seed, db);
  console.log(
    reset ? 'db/db.json restaurado a partir do seed.' : 'db/db.json criado a partir do seed.',
  );
}
