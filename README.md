# Gestão Financeira

Aplicação web de gestão financeira pessoal, desenvolvida como projeto de portfólio para demonstrar domínio de Angular, TypeScript, arquitetura front-end, integração com APIs, UX, qualidade de código e fundamentos de segurança.

Organiza contas, receitas, despesas, transferências, cartões de crédito, faturas, orçamentos e metas financeiras, com dashboard, tema claro/escuro e uma demonstração de criptografia no navegador.

**Demo publicada:** <https://gestao-financeira-tau-five.vercel.app>

> **Aviso:** este é um projeto demonstrativo. Utilize apenas dados fictícios — nunca credenciais, contas ou cartões reais. A API utilizada no desenvolvimento é simulada e não oferece segurança de produção.

## Demo

A [demo publicada](https://gestao-financeira-tau-five.vercel.app) (Vercel, atualizada a cada push na `main`, com preview em cada pull request) roda inteiramente no navegador: os dados ficam no `localStorage` e começam com um conjunto fictício de seis meses de movimentações.

- Entre com **Entrar com a conta de demonstração** (`demo@exemplo.com` / `demo1234`) ou crie uma conta.
- Para voltar ao estado inicial, use **Restaurar dados iniciais** na tela de login ou em Configurações.

## Funcionalidades

| Tela              | Destaques                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Login e cadastro  | Hash de senha PBKDF2-SHA256 (600 mil iterações), sessão criptografada (AES-256-GCM), guards de rota |
| Dashboard         | Resumo do período, receitas × despesas, evolução do saldo, transações recentes, orçamentos e metas  |
| Contas            | Busca e filtros, saldo atual calculado, arquivamento                                                |
| Transações        | Receitas, despesas e transferências, pendentes, compras no cartão, filtros por período e paginação  |
| Categorias        | Conjunto padrão, personalização, prevenção de duplicidade                                           |
| Cartões e faturas | Limite utilizado e disponível, ciclo de fatura, status, pagamento que não duplica despesas          |
| Orçamentos        | Limite mensal por categoria com vigências, alerta e consumo do mês                                  |
| Metas             | Progresso, status, ritmo mensal até o prazo e histórico de aportes                                  |
| Configurações     | Perfil, tema claro/escuro/sistema, cor de destaque (7 paletas) e densidade                          |
| Segurança         | Laboratório de criptografia (AES-256-GCM + PBKDF2) e exclusão da conta e dos dados                  |

## Stack

| Tecnologia                                                  | Uso                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| [Angular 22](https://angular.dev)                           | Framework (standalone, zoneless, Signals, Signal Forms)   |
| TypeScript 6                                                | Linguagem, em strict mode                                 |
| RxJS 7                                                      | Fluxos assíncronos e HTTP                                 |
| [Angular Material 22](https://material.angular.dev)         | Componentes de interface (Material Design 3)              |
| SCSS                                                        | Tema do Material e estilos dos componentes                |
| Material Symbols                                            | Ícones                                                    |
| Angular CDK 22                                              | Primitivas de interface (base do Material)                |
| [date-fns 4](https://date-fns.org)                          | Datas e adapter do datepicker do Material (pt-BR)         |
| [Chart.js 4](https://www.chartjs.org)                       | Gráficos do dashboard (componente próprio)                |
| Web Crypto API                                              | Hash de senha e criptografia no navegador                 |
| [JSON Server 0.17](https://github.com/typicode/json-server) | API REST simulada para desenvolvimento                    |
| [Faker](https://fakerjs.dev)                                | Geração do seed fictício (pt-BR, reproduzível)            |
| [Vitest](https://vitest.dev)                                | Testes unitários e de componentes                         |
| [Playwright](https://playwright.dev) + axe-core             | Testes E2E, de acessibilidade (WCAG 2.1 AA) e responsivos |
| angular-eslint + ESLint, Prettier                           | Análise estática e formatação                             |
| Husky + lint-staged + commitlint                            | Validações antes do commit e Conventional Commits         |
| GitHub Actions                                              | CI: formatação, lint, testes unitários, build e E2E       |
| [Vercel](https://vercel.com)                                | Hospedagem da demo                                        |

## Requisitos

- Node.js 26 LTS, definido em `.nvmrc` (ou outra versão compatível com Angular 22: `^22.22.3`, `^24.15.0` ou `>=26.0.0`). Os scripts de seed usam a execução nativa de TypeScript do Node 26.
- npm 11
- Git

## Como executar

Com a API simulada (desenvolvimento):

```bash
npm install
npm run start:dev
```

- Aplicação: `http://localhost:4200`
- API simulada: `http://localhost:3000`

Na primeira execução, `db/db.json` é criado a partir de `db/db.seed.json`, com as datas avançadas para o mês atual. Ele guarda apenas os dados do seu ambiente local e não é versionado; use `npm run db:reset` para voltar ao estado inicial.

Como na demo publicada, sem API (dados no `localStorage`):

```bash
npm run start:demo
```

## Scripts

| Script                 | Descrição                                                |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Inicia o servidor de desenvolvimento do Angular          |
| `npm run start:api`    | Inicia a API simulada (JSON Server) na porta 3000        |
| `npm run start:dev`    | Inicia o Angular e a API simulada juntos                 |
| `npm run start:demo`   | Inicia a versão da demo (localStorage, sem API)          |
| `npm run db:reset`     | Restaura os dados locais da API a partir do seed         |
| `npm run seed`         | Gera novamente `db/db.seed.json` com dados fictícios     |
| `npm run build`        | Gera o build de produção em `dist/`                      |
| `npm run build:demo`   | Gera o build da demo publicada                           |
| `npm test`             | Executa os testes unitários com Vitest                   |
| `npm run e2e`          | Executa os testes E2E e de acessibilidade com Playwright |
| `npm run e2e:report`   | Abre o relatório da última execução do Playwright        |
| `npm run lint`         | Executa o ESLint                                         |
| `npm run format`       | Formata o código com Prettier                            |
| `npm run format:check` | Verifica a formatação sem alterar arquivos               |

Antes da primeira execução dos testes E2E, instale o navegador: `npx playwright install chromium`.

## Arquitetura

A aplicação segue uma arquitetura orientada a funcionalidades (`core`, `shared`, `features` e `data-access`). As telas consomem facades, que usam contratos de repositório; as implementações ficam em `data-access`:

- **HTTP** (`data-access/repositories/http-*.repository.ts`): JSON Server, usada no desenvolvimento.
- **localStorage** (`data-access/local/`): usada na demo publicada. A configuração `demo` do Angular troca as implementações por `fileReplacements`, sem mudar nenhuma tela ou regra de negócio — o mesmo caminho para trocar a API simulada por um backend real.

```text
db/
  db.seed.json   # Seed fictício gerado por npm run seed (versionado)
  db.json        # Dados locais da API, criados a partir do seed (não versionado)
e2e/             # Testes E2E, de acessibilidade e responsivos (Playwright + axe)
scripts/         # ensure-db.mjs (cria db.json) e seed.mjs (gera o seed)
src/
  app/           # Código da aplicação
  testing/       # Repositórios em memória e fixtures dos testes unitários
  styles.scss    # Tema do Angular Material e estilos globais
  styles/        # Parciais SCSS compartilhados (breakpoints etc.)
public/          # Arquivos estáticos
vercel.json      # Build da demo, fallback da SPA e cabeçalhos de segurança
```

## Qualidade

- **Testes unitários e de componentes** (Vitest + harnesses do Material): regras de domínio, facades, repositórios, formulários e telas, inclusive a validação do seed contra as regras do app.
- **E2E** (Playwright, contra a build de demo): login, cadastro, navegação, lançamento de transação, pagamento de fatura, persistência e restauração dos dados. O relógio do navegador é fixado na data de referência do seed para resultados determinísticos.
- **Acessibilidade**: axe-core (WCAG 2.0/2.1 A e AA) em todas as telas principais, nos temas claro e escuro.
- **Responsividade**: navegação pelo menu recolhido e ausência de rolagem horizontal num celular (Pixel 7).
- **CI**: cada push na `main` e cada pull request passam por formatação, lint, testes unitários, build e E2E.

## Padrão de commits

Os commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```text
<type>(<scope>): <description>
```

Exemplos: `feat(accounts): add account form`, `fix(transactions): validate transfer accounts`, `chore: update dependencies`.

Os hooks de Git validam automaticamente:

- **pre-commit:** ESLint e Prettier nos arquivos alterados.
- **commit-msg:** formato da mensagem de commit.
