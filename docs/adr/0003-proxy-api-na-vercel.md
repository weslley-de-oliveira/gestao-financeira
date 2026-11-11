# 0003. Proxy `/api` na Vercel, com a API na mesma origem

- **Data:** 06/11/2026 (deploy da API)
- **Status:** aceita

## Contexto

O front fica na Vercel e a API no Render, em domínios diferentes. A sessão é um cookie `HttpOnly` com prefixo `__Host-` (ADR 0001 da API). Com a API em outro domínio, o cookie seria de terceiros: navegadores com proteção contra rastreamento o bloqueiam, e seria preciso CORS com credenciais e `SameSite=None`.

## Decisão

- O `vercel.json` faz o `rewrite` de `/api/:path*` para a API no Render. Para o navegador, front e API estão no mesmo domínio.
- O front chama sempre caminhos relativos (`/api/v1/...`). Em desenvolvimento, o `ng serve` faz o mesmo papel com o `proxy.conf.json`, e nos E2E contra a API, com o `proxy.e2e.conf.json`.
- Em produção, a API desliga o CORS e só aceita escrita com `Origin` igual ao endereço do front (`APP_ORIGIN`).

## Alternativas descartadas

- **CORS com credenciais:** cookie de terceiros, `SameSite=None` e mais superfície para CSRF.
- **Token em cabeçalho `Authorization`:** dispensa o cookie, mas o token fica acessível ao JavaScript (ADR 0001 da API).
- **Domínio próprio com subdomínios (`app.` e `api.`):** resolveria o cookie, mas exige comprar e configurar um domínio.

## Consequências

- Cookie da mesma origem, sem CORS, e a mesma configuração em desenvolvimento, E2E e produção.
- Cada pedido passa pela Vercel: mais um salto de rede, e a API precisa confiar nos cabeçalhos `X-Forwarded-*` de dois proxies (`TRUST_PROXY=2`).
- O proxy da Vercel acrescenta cabeçalhos de cache próprios, o que causou o bug do 304 com saldo antigo (ADR 0008 da API).
