# 0005. Angular Material com SCSS

- **Data:** 04/11/2026
- **Status:** aceita

## Contexto

O app precisa de componentes acessíveis prontos (tabelas com paginação, diálogos, datepicker, selects, menus), tema claro e escuro e uma cor de destaque escolhida pela pessoa. A biblioteca precisa acompanhar o Angular 22 e funcionar com Signal Forms.

## Decisão

- **Angular Material 22** (Material Design 3), com o tema em `src/styles.scss` e tokens próprios (`--app-income`, `--chart-*`) para o que o Material não cobre.
- **SCSS** nos componentes, com orçamento de tamanho por arquivo no `angular.json`.
- **7 paletas de destaque** independentes do modo claro ou escuro, trocadas em tempo real pelas preferências.
- **Acessibilidade conferida no CI:** o axe-core roda nas telas principais, nos dois temas.

## Alternativas descartadas

- **PrimeNG:** a versão para o Angular 22 passou a exigir chave de licença.
- **Spartan (shadcn para Angular) com Tailwind:** experimentado no início, mas trocado pelo Material, que tem mais componentes prontos e era mais familiar.

## Consequências

- Componentes acessíveis e testáveis com harnesses, que os testes de tela usam no lugar de seletores CSS.
- A aparência segue o Material Design; o visual próprio (barra lateral, paleta azul-marinho, fonte Inter) vem de tokens e de SCSS por cima do tema.
- Atualizar o Angular implica atualizar o Material junto, na mesma versão principal.
