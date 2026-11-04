# Gestão Financeira

Aplicação web de gestão financeira pessoal, desenvolvida como projeto de portfólio para demonstrar domínio de Angular, TypeScript, arquitetura front-end, integração com APIs, UX, qualidade de código e fundamentos de segurança.

O sistema permitirá organizar contas, receitas, despesas, cartões de crédito, faturas, orçamentos e metas financeiras.

> **Status:** em desenvolvimento. Implementados: fundação (tema, layout, navegação, CI), autenticação demonstrativa, contas (listagem com busca e filtros, cadastro, edição, detalhe e arquivamento) categorias de receita e despesa (conjunto padrão, personalização, prevenção de duplicidade e arquivamento) e transações (receitas, despesas e transferências, com status pendente, filtros por período e paginação). Próximas etapas: dashboard, cartões e faturas.

> **Aviso:** este é um projeto demonstrativo. Utilize apenas dados fictícios — nunca credenciais, contas ou cartões reais. A API utilizada no desenvolvimento é simulada e não oferece segurança de produção.

## Funcionalidades previstas

| Prioridade    | Telas                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| MVP           | Login, cadastro, dashboard, contas, transações e categorias               |
| Segunda etapa | Orçamentos, cartões de crédito, faturas, metas, configurações e segurança |

## Stack atual

| Tecnologia                                                  | Uso                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| [Angular 22](https://angular.dev)                           | Framework (standalone, zoneless, Signals)             |
| TypeScript 6                                                | Linguagem, em strict mode                             |
| RxJS 7                                                      | Fluxos assíncronos e HTTP                             |
| [Angular Material 22](https://material.angular.dev)         | Componentes de interface (Material Design 3)          |
| SCSS                                                        | Tema do Material e estilos dos componentes            |
| Material Symbols                                            | Ícones                                                |
| Angular CDK 22                                              | Primitivas de interface (base do Material)            |
| [date-fns 4](https://date-fns.org)                          | Datas e adapter do datepicker do Material (pt-BR)     |
| [JSON Server 0.17](https://github.com/typicode/json-server) | API REST simulada para desenvolvimento                |
| concurrently                                                | Execução paralela do Angular e da API simulada        |
| [Vitest](https://vitest.dev)                                | Testes unitários                                      |
| angular-eslint + ESLint                                     | Análise estática                                      |
| Prettier                                                    | Formatação                                            |
| Husky + lint-staged                                         | Validação dos arquivos alterados antes do commit      |
| commitlint                                                  | Validação de mensagens no padrão Conventional Commits |

Outras ferramentas, como Playwright, gráficos e geração de dados fictícios, serão adicionadas conforme as funcionalidades forem implementadas.

## Requisitos

- Node.js 26 LTS, definido em `.nvmrc` (ou outra versão compatível com Angular 22: `^22.22.3`, `^24.15.0` ou `>=26.0.0`)
- npm 11
- Git

## Como executar

```bash
npm install
npm run start:dev
```

- Aplicação: `http://localhost:4200`
- API simulada: `http://localhost:3000`

Na primeira execução, `db/db.json` é criado a partir de `db/db.seed.json`. Ele guarda apenas os dados do seu ambiente local e não é versionado; use `npm run db:reset` para voltar ao estado inicial.

## Scripts

| Script                 | Descrição                                         |
| ---------------------- | ------------------------------------------------- |
| `npm start`            | Inicia o servidor de desenvolvimento do Angular   |
| `npm run start:api`    | Inicia a API simulada (JSON Server) na porta 3000 |
| `npm run db:reset`     | Restaura os dados locais da API a partir do seed  |
| `npm run start:dev`    | Inicia o Angular e a API simulada juntos          |
| `npm run build`        | Gera o build de produção em `dist/`               |
| `npm test`             | Executa os testes unitários com Vitest            |
| `npm run lint`         | Executa o ESLint                                  |
| `npm run format`       | Formata o código com Prettier                     |
| `npm run format:check` | Verifica a formatação sem alterar arquivos        |

## Estrutura

```text
db/
  db.seed.json   # Dados iniciais da API simulada (versionado)
  db.json        # Dados locais, criados a partir do seed (não versionado)
scripts/         # Scripts de apoio (ex.: ensure-db.mjs)
src/
  app/           # Código da aplicação
  styles.scss    # Tema do Angular Material e estilos globais
  styles/        # Parciais SCSS compartilhados (breakpoints etc.)
public/          # Arquivos estáticos
```

A aplicação seguirá uma arquitetura orientada a funcionalidades (`core`, `shared`, `features` e `data-access`), na qual os componentes consomem facades e repositórios em vez de chamar a API diretamente. Assim, a API simulada poderá ser substituída por um backend real sem reescrever as telas.

## Padrão de commits

Os commits seguem o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/):

```text
<type>(<scope>): <description>
```

Exemplos: `feat(accounts): add account form`, `fix(transactions): validate transfer accounts`, `chore: update dependencies`.

Os hooks de Git validam automaticamente:

- **pre-commit:** ESLint e Prettier nos arquivos alterados.
- **commit-msg:** formato da mensagem de commit.
