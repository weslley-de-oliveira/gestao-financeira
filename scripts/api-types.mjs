// Gera os tipos TypeScript do contrato da API (src/app/data-access/api/api-schema.ts) a partir do
// openapi.json versionado no repositório da API. Uso: npm run api:types
// Origem: a variável API_OPENAPI (caminho ou URL); senão, o repositório vizinho
// ../gestao-financeira-api; senão, o arquivo publicado no GitHub.
// O openapi-typescript roda pelo npx, numa versão fixa: ele exige TypeScript 5, e o projeto usa o 6.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sibling = fileURLToPath(new URL('../../gestao-financeira-api/openapi.json', import.meta.url));
const published =
  'https://raw.githubusercontent.com/weslley-de-oliveira/gestao-financeira-api/main/openapi.json';
const source = process.env['API_OPENAPI'] ?? (existsSync(sibling) ? sibling : published);
const output = 'src/app/data-access/api/api-schema.ts';

execSync(`npx --yes openapi-typescript@7.13.0 "${source}" -o ${output}`, { stdio: 'inherit' });
execSync(`npx prettier --write ${output}`, { stdio: 'inherit' });
console.log(`Tipos gerados de ${source}.`);
