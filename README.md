# Gestão Financeira

Aplicação web de gestão financeira pessoal, desenvolvida como projeto de portfólio para demonstrar domínio de Angular, TypeScript, arquitetura front-end, integração com APIs, UX, qualidade de código e fundamentos de segurança.

Organiza contas, receitas, despesas, transferências, cartões de crédito, faturas, orçamentos e metas financeiras, com dashboard, tema claro/escuro e uma demonstração de criptografia no navegador.

**Demo publicada:** <https://gestao-financeira-tau-five.vercel.app>

> **Aviso:** este é um projeto demonstrativo. Utilize apenas dados fictícios — nunca credenciais, contas ou cartões reais. A autenticação local da demo (no navegador) é demonstrativa e não oferece segurança de produção.

## Demo

A [demo publicada](https://gestao-financeira-tau-five.vercel.app) (Vercel, atualizada a cada push na `main`, com preview em cada pull request) usa a [API própria](https://github.com/weslley-de-oliveira/gestao-financeira-api), no Render, com o banco no Neon. A Vercel encaminha `/api/*` para a API (`vercel.json`): o navegador fala só com a origem do front, e o cookie de sessão é dessa origem.

- Entre com **Entrar com a conta de demonstração** (`demo@exemplo.com` / `demo1234`), com seis meses de dados fictícios, ou crie uma conta. A conta de demonstração é compartilhada por quem visita o projeto.
- A API roda no plano gratuito e hiberna sem uso: a primeira visita depois disso pode levar até um minuto (a tela de carregamento explica a espera).
- A versão com os dados só no navegador (`localStorage`) continua disponível com `npm run start:demo` e é a usada nos testes E2E de demo; nela, **Restaurar dados iniciais** volta ao estado inicial.

## Funcionalidades

| Tela              | Destaques                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login e cadastro  | Sessão em cookie HttpOnly (API) ou criptografada no navegador (demo, PBKDF2), com os guards de rota                                                     |
| Dashboard         | Resumo do período, receitas × despesas, evolução do saldo, transações recentes, orçamentos e metas                                                      |
| Contas            | Busca e filtros, saldo atual calculado, arquivamento                                                                                                    |
| Transações        | Receitas, despesas e transferências, pendentes, compras no cartão, estornos, busca, filtros, ordenação e paginação no servidor                          |
| Categorias        | Conjunto padrão, personalização, prevenção de duplicidade                                                                                               |
| Cartões e faturas | Limite utilizado e disponível, ciclo de fatura, status, pagamento que não duplica despesas, compras parceladas (2 a 24x), antecipar e cancelar parcelas |
| Orçamentos        | Limite mensal por categoria com vigências, alerta e consumo do mês                                                                                      |
| Metas             | Progresso, status, ritmo mensal até o prazo e histórico de aportes                                                                                      |
| Configurações     | Perfil, tema claro/escuro/sistema, cor de destaque (7 paletas) e densidade                                                                              |
| Segurança         | Troca de senha, laboratório de criptografia (AES-256-GCM + PBKDF2) e exclusão da conta                                                                  |

## Stack

| Tecnologia                                          | Uso                                                       |
| --------------------------------------------------- | --------------------------------------------------------- |
| [Angular 22](https://angular.dev)                   | Framework (standalone, zoneless, Signals, Signal Forms)   |
| TypeScript 6                                        | Linguagem, em strict mode                                 |
| RxJS 7                                              | Fluxos assíncronos e HTTP                                 |
| [Angular Material 22](https://material.angular.dev) | Componentes de interface (Material Design 3)              |
| SCSS                                                | Tema do Material e estilos dos componentes                |
| Material Symbols                                    | Ícones                                                    |
| Angular CDK 22                                      | Primitivas de interface (base do Material)                |
| [date-fns 4](https://date-fns.org)                  | Datas e adapter do datepicker do Material (pt-BR)         |
| [Chart.js 4](https://www.chartjs.org)               | Gráficos do dashboard (componente próprio)                |
| Web Crypto API                                      | Hash de senha e criptografia no navegador                 |
| `gestao-financeira-api`                             | Backend próprio: Node.js, Fastify e PostgreSQL            |
| openapi-typescript                                  | Tipos do contrato da API, gerados do OpenAPI              |
| [Faker](https://fakerjs.dev)                        | Geração do seed fictício (pt-BR, reproduzível)            |
| [Vitest](https://vitest.dev)                        | Testes unitários e de componentes                         |
| [Playwright](https://playwright.dev) + axe-core     | Testes E2E, de acessibilidade (WCAG 2.1 AA) e responsivos |
| angular-eslint + ESLint, Prettier                   | Análise estática e formatação                             |
| Husky + lint-staged + commitlint                    | Validações antes do commit e Conventional Commits         |
| GitHub Actions                                      | CI: formatação, lint, testes unitários, build e E2E       |
| [Vercel](https://vercel.com)                        | Hospedagem do front, com `rewrite` de `/api` para a API   |

## Requisitos

- Node.js 26 LTS, definido em `.nvmrc` (ou outra versão compatível com Angular 22: `^22.22.3`, `^24.15.0` ou `>=26.0.0`). Os scripts de seed usam a execução nativa de TypeScript do Node 26.
- npm 11
- Git

## Como executar

Com a API real (desenvolvimento): suba a [`gestao-financeira-api`](https://github.com/weslley-de-oliveira/gestao-financeira-api) na porta 3333, seguindo o README dela (`npm run db:up`, `npm run db:migrate`, `npm run db:seed` e `npm run dev`), e depois o front:

```bash
npm install
npm start
```

- Aplicação: `http://localhost:4200`, com a conta de demonstração `demo@exemplo.com` / `demo1234` criada pelo seed da API.
- O `ng serve` encaminha `/api` para `http://127.0.0.1:3333` (`proxy.conf.json`): front e API ficam na mesma origem, e o cookie de sessão funciona sem CORS.

Como na demo publicada, sem API (dados no `localStorage`):

```bash
npm run start:demo
```

## Scripts

| Script                 | Descrição                                                |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Inicia o Angular, com o proxy para a API local           |
| `npm run start:demo`   | Inicia a versão da demo (localStorage, sem API)          |
| `npm run seed`         | Gera novamente o seed da demo (`db/db.seed.json`)        |
| `npm run api:types`    | Gera os tipos do contrato a partir do OpenAPI da API     |
| `npm run build`        | Gera o build de produção em `dist/`                      |
| `npm run build:demo`   | Gera o build da demo com dados no navegador              |
| `npm test`             | Executa os testes unitários com Vitest                   |
| `npm run e2e`          | Executa os testes E2E e de acessibilidade com Playwright |
| `npm run e2e:api`      | Executa os testes E2E contra a API real                  |
| `npm run e2e:report`   | Abre o relatório da última execução do Playwright        |
| `npm run lint`         | Executa o ESLint                                         |
| `npm run format`       | Formata o código com Prettier                            |
| `npm run format:check` | Verifica a formatação sem alterar arquivos               |

Antes da primeira execução dos testes E2E, instale o navegador: `npx playwright install chromium`.

O `npm run e2e:api` sobe uma instância própria da API (porta 3334) a partir do repositório [`gestao-financeira-api`](https://github.com/weslley-de-oliveira/gestao-financeira-api), clonado ao lado deste (ou na pasta de `API_DIR`), e usa o banco do `.env` dela, com as migrações aplicadas e a conta de demonstração criada (`npm run db:migrate` e `npm run db:seed` na API).

## Arquitetura

A aplicação segue uma arquitetura orientada a funcionalidades (`core`, `shared`, `features` e `data-access`). As telas consomem facades, que usam contratos de repositório; as implementações ficam em `data-access`:

- **API** (`data-access/api/`): a API real, com os tipos do contrato gerados do OpenAPI (`npm run api:types`). Um interceptor converte as recusas da API (Problem Details) nos erros que as telas já exibem e, numa sessão expirada, leva ao login. Nenhuma tela baixa a lista completa de transações: a listagem pede uma página por vez (filtros, ordenação e cursor no servidor) e os totais em `GET /v1/transactions/summary`; dashboard, faturas, consumo dos orçamentos, saldos, uso dos cartões e uso das categorias vêm calculados do servidor. As edições enviam `If-Match` com a versão que o formulário carregou (alterada em outra aba → aviso, sem sobrescrever); o pagamento de fatura envia `Idempotency-Key` e repete uma vez, com a mesma chave, se a resposta se perder.
- **localStorage** (`data-access/local/`): usada na demo (`ng build -c demo`) e nos E2E. A configuração `demo` troca as implementações por `fileReplacements`, sem mudar nenhuma tela ou regra de negócio; os mesmos cálculos são feitos no navegador, sobre a lista completa (`TransactionSource`). Esse contrato só é registrado na demo e nos testes: na build publicada, nada consegue baixar a lista completa.

- **Content Security Policy** (`vercel.json`): scripts só do próprio domínio, mais o hash do único script inline do Angular (o que aplica o CSS crítico); estilos inline permitidos (Angular e Material os injetam); fontes do Google Fonts; pedidos só à mesma origem (`/api`); a página não pode ser embutida em outro site. Ao atualizar o Angular, se o script inline mudar, os E2E acusam a violação: recalcule o hash (`sha256` do conteúdo do `<script>` em `dist/gestao-financeira/browser/index.html`).
- **Compras parceladas:** cada parcela é uma compra comum no cartão, na fatura do seu mês ("Parcela 3 de 10" na listagem, na fatura e no detalhe), e conta no orçamento do mês dela. O limite reserva o total na hora. A divisão (sobra dos centavos na 1ª) e as datas seguem as mesmas funções da API (`features/installments/domain/installment-plan.ts`), usadas na prévia do formulário e na demo. A compra só muda inteira: descrição, categoria e observações pelo detalhe da parcela, ou excluir todas as parcelas (recusado se alguma estiver numa fatura paga).
- **Antecipar e cancelar parcelas:** pelo detalhe de uma parcela, "Antecipar parcelas" leva as últimas para a fatura atual (a data delas passa a ser hoje; o desconto do banco vira um estorno da parcela antecipada), e "Cancelar parcelas" estorna o que falta das parcelas da fatura atual e das futuras, cada uma na sua fatura. Parcelas de faturas fechadas não mudam. As regras (`features/installments/domain/installment-actions.ts`) são as mesmas da API, que informa na compra quantas parcelas dá para antecipar e quanto o cancelamento estornaria.
- **Estornos:** uma despesa realizada (em conta, no cartão ou uma parcela) recebe um ou mais estornos, até o valor dela, pelo detalhe ("Registrar estorno": o padrão é o que falta estornar, com a data de hoje). O estorno é uma transação `refund` ligada à despesa: na conta, devolve o valor; no cartão, abate a fatura em que a data cai e libera o limite (se passar das compras, a fatura mostra crédito, que não passa para a seguinte). No mês dele, reduz o gasto da categoria da despesa no orçamento e entra como despesa negativa nos totais e no dashboard. As regras (`features/refunds/domain/refund-rules.ts`) são as mesmas da API; uma despesa com estornos só muda descrição, categoria e observações, e só é excluída depois dos estornos.
- **Filtros na URL:** a tela de Transações guarda busca, tipo, conta, categoria, status e ordenação na URL (`?busca=…&tipo=expense`), sem criar entradas no histórico; voltar, recarregar ou compartilhar o link mantém a lista. O período fica no seletor da barra superior.

```text
db/
  db.seed.json   # Seed fictício da demo, gerado por npm run seed
e2e/             # Testes E2E, de acessibilidade e responsivos (Playwright + axe)
e2e-api/         # Testes E2E contra a API real (playwright.api.config.ts)
scripts/         # seed.mjs (gera o seed da demo) e api-types.mjs (tipos do OpenAPI)
src/
  app/           # Código da aplicação
  testing/       # Repositórios em memória e fixtures dos testes unitários
  styles.scss    # Tema do Angular Material e estilos globais
  styles/        # Parciais SCSS compartilhados (breakpoints etc.)
public/          # Arquivos estáticos
vercel.json      # Build publicada, rewrite de /api para a API, fallback da SPA e cabeçalhos
```

## Qualidade

- **Testes unitários e de componentes** (Vitest + harnesses do Material): regras de domínio, facades, repositórios, formulários e telas, inclusive a validação do seed contra as regras do app.
- **E2E** (Playwright, contra a build de demo): login, cadastro, navegação, lançamento de transação, pagamento de fatura, compra parcelada (prévia, faturas e exclusão), estorno de uma compra no cartão (detalhe e crédito na fatura), antecipação e cancelamento de parcelas, filtros de Transações na URL, persistência e restauração dos dados. O relógio do navegador é fixado na data de referência do seed para resultados determinísticos, e todas as páginas rodam com a Content Security Policy do `vercel.json` valendo: qualquer violação falha o teste.
- **E2E contra a API real** (`npm run e2e:api`): sessão em cookie (restauração, expiração e saída), saldo calculado pelo servidor, dashboard numa chamada só, listagem de transações paginada, ordenada e totalizada no servidor (sem baixar a lista completa), compra parcelada registrada e excluída pela API, estorno de compra no cartão (fatura, limite e 409 ao excluir a despesa), antecipação e cancelamento de parcelas (fatura zerada e limite liberado), troca de senha e exclusão da conta com senha. Na CI, com Postgres e o seed da API.
- **Acessibilidade**: axe-core (WCAG 2.0/2.1 A e AA) em todas as telas principais, nos temas claro e escuro.
- **Responsividade**: navegação pelo menu recolhido e ausência de rolagem horizontal num celular (Pixel 7).
- **CI**: cada push na `main` e cada pull request passam por formatação, lint, testes unitários, build e E2E (demo e API real).

## Padrão de commits

Os commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```text
<type>(<scope>): <description>
```

Exemplos: `feat(accounts): add account form`, `fix(transactions): validate transfer accounts`, `chore: update dependencies`.

Os hooks de Git validam automaticamente:

- **pre-commit:** ESLint e Prettier nos arquivos alterados.
- **commit-msg:** formato da mensagem de commit.
