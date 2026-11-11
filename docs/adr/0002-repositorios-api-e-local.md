# 0002. Repositórios com duas implementações: API e `localStorage`

- **Data:** 04/11/2026 (contratos); a implementação da API entrou em 05/11/2026
- **Status:** aceita

## Contexto

O front foi construído antes da API, com os dados no navegador. Quando a API ficou pronta, três necessidades continuaram: uma demo que funciona sem servidor, testes E2E rápidos e determinísticos (relógio fixo, dados conhecidos) e telas que não dependem de como os dados são buscados.

## Decisão

- As telas usam **facades**, que dependem de **contratos** em `data-access/repositories/` (`AccountRepository`, `InvoiceRepository`, `TransactionRepository`…).
- Há duas implementações de cada contrato:
  - `data-access/api/`: HTTP contra a API, com os tipos gerados do OpenAPI;
  - `data-access/local/`: `localStorage`, calculando com as mesmas regras de `features/*/domain/` ([ADR 0006](0006-regras-repetidas-no-front.md)).
- A escolha é feita na build: `data-access.providers.ts` registra a da API; a configuração `demo` troca esse arquivo por `data-access.providers.demo.ts` (`fileReplacements`).
- Contratos que só fazem sentido na demo (`TransactionSource`, a lista completa de transações) são registrados só na demo e nos testes. Na build publicada, nenhum código consegue baixar a lista completa.

## Alternativas descartadas

- **Mock da API com JSON Server ou MSW:** a demo dependeria de um servidor (ou de um service worker) e as regras de negócio continuariam fora do navegador.
- **Só a API, com E2E sempre contra ela:** E2E mais lentos, dependentes do banco e do relógio do servidor. Os E2E contra a API existem (`e2e-api/`), mas cobrem o que só a API faz.

## Consequências

- Os E2E da demo (relógio fixo, dados do seed) rodam em poucos minutos e não dependem de rede.
- Cada operação nova precisa das duas implementações; os testes dos repositórios e das facades rodam contra as duas formas.
- Trocar de backend, ou de forma de busca, não muda nenhuma tela.
