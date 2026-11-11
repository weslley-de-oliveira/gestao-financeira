# 0001. Angular zoneless, com Signals e Signal Forms

- **Data:** 04/11/2026
- **Status:** aceita

## Contexto

O projeto começou no Angular 22, em que a aplicação sem Zone.js é o padrão e os Signals são a forma recomendada de estado. Formulários financeiros têm validações que dependem umas das outras (valor até o saldo da fatura, prazo de meta no futuro, conta obrigatória só para alguns tipos de transação), e o projeto também serve para mostrar domínio do Angular atual.

## Decisão

- **Sem Zone.js:** a detecção de mudanças acontece quando um signal lido no template muda ou um evento do template dispara. Todos os componentes são standalone.
- **Estado em signals nas facades** (`signal` e `computed`); RxJS fica no HTTP e em fluxos com cancelamento.
- **Signal Forms** (`form`, `schema`, `validate`, `[formField]`) nos formulários, com os componentes do Angular Material. Os schemas ficam em `features/*/forms/`.
- **Testes com Vitest** (`@angular/build:unit-test`), com os harnesses do Material para interagir com as telas.

## Alternativas descartadas

- **Zone.js e Reactive Forms:** estáveis e conhecidos, mas o caminho recomendado pelo framework mudou; o projeto teria de migrar depois.
- **Uma biblioteca de estado (NgRx, por exemplo):** as facades com signals bastam para o tamanho do app, sem actions e reducers para cada caso de uso.

## Consequências

- Menos código de infraestrutura: nada de `async` pipe e `subscribe` para estado de tela, e mudanças de estado previsíveis nos testes.
- Signal Forms ainda é uma API nova: a integração com `mat-select`, `mat-slide-toggle` e o datepicker foi conferida tela a tela, e os seletores próprios de cor e de ícone implementam `FormValueControl` para funcionar com `[formField]`.
- Código assíncrono que muda estado fora de um signal não atualiza a tela; os testes de componente pegam esses casos.
