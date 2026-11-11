# 0004. Content Security Policy aplicada, com hash do script inline

- **Data:** 06/11/2026
- **Status:** aceita

## Contexto

Mesmo com a sessão num cookie `HttpOnly`, um XSS ainda poderia agir em nome da pessoa: ler a tela e chamar a API. Uma CSP restritiva limita o estrago, mas o build do Angular gera um script inline (o que aplica o CSS crítico), e o Material injeta estilos inline. Aplicar uma política errada direto em produção quebraria a página.

## Decisão

- **Em duas fases:**
  1. `Content-Security-Policy-Report-Only`, conferida em produção, página a página;
  2. só depois, a política aplicada.
- **Política** (`vercel.json`):
  - scripts só do próprio domínio, mais o `sha256` do único script inline do Angular;
  - estilos inline permitidos (Angular e Material dependem deles);
  - fontes do Google Fonts;
  - pedidos só à mesma origem;
  - `frame-ancestors 'none'`.
- **Os E2E aplicam a mesma política:** a fixture lê a CSP do `vercel.json`, serve as páginas com ela e falha em qualquer evento `securitypolicyviolation`. Se uma atualização do Angular mudar o script inline, o CI acusa antes do deploy.

## Alternativas descartadas

- **`'unsafe-inline'` para scripts:** anularia a proteção contra XSS.
- **Nonce por requisição:** exige renderizar o `index.html` no servidor a cada pedido; o front é estático.
- **Desligar o CSS crítico inline:** pioraria o primeiro carregamento só para evitar um hash.

## Consequências

- Um script injetado não roda; isso foi conferido em produção.
- O hash precisa ser recalculado quando o Angular muda o script inline, e o E2E avisa quando isso acontece.
- `style-src 'unsafe-inline'` continua: uma injeção de CSS ainda é possível, com impacto bem menor que a de script.
