// Cria db/db.json (local, não versionado) a partir de db/db.seed.json, avançando as datas do seed
// para o mês atual (ver src/app/data-access/local/seed-dates.ts).
// Uso: node scripts/ensure-db.mjs [--reset]   (--reset sobrescreve os dados locais)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { monthsSinceAnchor, shiftSeedDates } from '../src/app/data-access/local/seed-dates.ts';

const seedFile = new URL('../db/db.seed.json', import.meta.url);
const dbFile = new URL('../db/db.json', import.meta.url);
const reset = process.argv.includes('--reset');

if (reset || !existsSync(dbFile)) {
  const { meta, ...collections } = JSON.parse(readFileSync(seedFile, 'utf8'));
  const months = meta ? monthsSinceAnchor(meta.anchorDate, new Date()) : 0;
  writeFileSync(dbFile, `${JSON.stringify(shiftSeedDates(collections, months), null, 2)}\n`);
  console.log(
    reset ? 'db/db.json restaurado a partir do seed.' : 'db/db.json criado a partir do seed.',
  );
}
