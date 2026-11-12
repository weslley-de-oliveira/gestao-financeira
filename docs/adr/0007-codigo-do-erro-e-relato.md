# 0007. Código do erro na tela e relato de erros à API

- **Data:** 11/11/2026 (etapa 18)
- **Status:** aceita

## Contexto

As telas tratam as recusas esperadas com mensagens próprias (fatura paga, registro alterado em outra aba). Para o resto, mostram uma mensagem genérica: "Não foi possível salvar a conta. Tente novamente em instantes." Quem recebia essa mensagem não tinha como dizer qual requisição falhou. E os erros de JavaScript e as falhas antes da API (rede, proxy, API hibernando) não ficavam registrados em lugar nenhum.

## Decisão

- **Id por requisição** (`core/interceptors/request-id.interceptor.ts`): cada requisição à API leva um UUID em `X-Request-Id`, que a API usa nos logs. O id fica associado ao erro que a requisição produzir (`requestIdOf(erro)`), sem mudar o tipo do erro, então as telas e os repositórios continuam tratando os mesmos erros.
- **Código na mensagem** (`core/errors/unexpected-error-message.ts`): as mensagens genéricas ganham "Código do erro: 3f9a1c2e.", os 8 primeiros caracteres do id. Mensagens de recusas esperadas continuam sem código.
- **Relato à API** (`core/errors/`): o `ReportingErrorHandler` relata os erros de JavaScript não tratados, e o interceptor relata as requisições sem resposta da API (status 0, ou 5xx sem Problem Details). Os 5xx da própria API não são relatados, porque ela já os registra. Cada mensagem vai uma vez, até 5 por carregamento da página, e uma falha do relato é ignorada.
- **Contrato próprio** (`ErrorReportRepository`): na build publicada, `POST /v1/client-errors`; na demo, sem servidor, o console.

A decisão do lado da API (logs, rota pública, por que não Sentry) está no [ADR 0009 da API](https://github.com/weslley-de-oliveira/gestao-financeira-api/blob/main/docs/adr/0009-rastreamento-de-erros-nos-logs.md).

## Alternativas descartadas

- **SDK do Sentry no front:** agrupamento e alertas prontos, mas com conta, chave, CSP aberta para outro domínio e dados de uso enviados a terceiros.
- **Um tipo de erro novo com o id:** as telas e os repositórios comparam erros com `instanceof`; trocar o tipo quebraria esses tratamentos.

## Consequências

- Quem vê uma falha pode informar um código que leva direto ao log da requisição.
- Os erros que só existiam no navegador passam a aparecer nos logs da API, com a página, o navegador e o id da requisição.
- Toda mensagem genérica nova precisa passar por `unexpectedErrorMessage`; os testes de tela continuam com o texto sem código, porque os repositórios em memória não fazem requisições.
