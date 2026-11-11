# 0006. Regras de domínio repetidas no front, com os casos de teste da API

- **Data:** 05/11/2026 (início da API); as regras já existiam no front desde 04/11/2026
- **Status:** aceita

## Contexto

As regras financeiras (ciclo e saldo das faturas, parcelas, estornos, orçamentos, ritmo das metas) nasceram no front, quando os dados ficavam no navegador. Com a API, o servidor passou a ser a fonte da verdade. A demo sem servidor ([ADR 0002](0002-repositorios-api-e-local.md)) e as prévias nos formulários (valor de cada parcela, saldo depois do pagamento) continuam precisando das mesmas contas no navegador.

## Decisão

- As regras ficam em **funções puras** em `features/*/domain/` (por exemplo, `invoice-rules.ts`, `installment-plan.ts`, `refund-rules.ts`), sem Angular e sem acesso a dados.
- A API tem os mesmos arquivos, portados para o servidor. Quando uma regra muda, ela muda primeiro na API e é portada para o front na mesma etapa, **com os mesmos casos de teste** (os mesmos cenários e os mesmos valores esperados nos dois repositórios).
- Na build publicada, os valores calculados (saldos, faturas, uso do limite, consumo dos orçamentos) vêm prontos da API; o front usa as funções só nas prévias. Na demo, as funções calculam tudo.

## Alternativas descartadas

- **Pacote compartilhado (monorepo com `packages/domain`):** uma fonte só, mas exigiria reestruturar os dois repositórios e publicar o pacote.
- **Só a API calcula:** acabaria com a demo offline e com as prévias sem ida ao servidor.

## Consequências

- A demo e a versão publicada dão os mesmos números, e as prévias aparecem sem esperar a API.
- Há duas cópias de cada regra. O risco de divergência é controlado pelos casos de teste repetidos e pelos testes de paridade da API (`*.parity.test.ts`, que comparam o cálculo em SQL com as funções puras).
- Uma mudança de regra custa duas implementações; em troca, cada repositório continua independente.
