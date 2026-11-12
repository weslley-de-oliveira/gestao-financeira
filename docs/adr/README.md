# Decisões de arquitetura (ADRs)

Cada registro explica uma decisão que molda o front: o contexto, o que foi decidido, as alternativas descartadas e as consequências, no formato de Michael Nygard.

Os registros foram escritos em novembro de 2026, depois das decisões, a partir do plano e do histórico do projeto. A data de cada um é a da decisão. As decisões da API (sessão, centavos, faturas calculadas, paginação, concorrência, isolamento, migrações e cache) ficam no [repositório da API](https://github.com/weslley-de-oliveira/gestao-financeira-api/tree/main/docs/adr).

| Nº                                        | Decisão                                                            | Data       |
| ----------------------------------------- | ------------------------------------------------------------------ | ---------- |
| [0001](0001-angular-zoneless-signals.md)  | Angular zoneless, com Signals e Signal Forms                       | 04/11/2026 |
| [0002](0002-repositorios-api-e-local.md)  | Repositórios com duas implementações: API e `localStorage`         | 04/11/2026 |
| [0003](0003-proxy-api-na-vercel.md)       | Proxy `/api` na Vercel, com a API na mesma origem                  | 06/11/2026 |
| [0004](0004-csp-aplicada.md)              | Content Security Policy aplicada, com hash do script inline        | 06/11/2026 |
| [0005](0005-angular-material-scss.md)     | Angular Material com SCSS                                          | 04/11/2026 |
| [0006](0006-regras-repetidas-no-front.md) | Regras de domínio repetidas no front, com os casos de teste da API | 05/11/2026 |
| [0007](0007-codigo-do-erro-e-relato.md)   | Código do erro na tela e relato de erros à API                     | 11/11/2026 |
