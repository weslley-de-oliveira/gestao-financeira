import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { applyMoneyMask } from '../utils/money';

/**
 * Aplica a máscara de moeda (dígitos entrando pela direita) a um `<input>` de texto.
 * Funciona junto com `[formField]`: o modelo recebe o texto já mascarado ("1.234,56").
 */
@Directive({ selector: 'input[appMoneyMask]' })
export class MoneyMaskDirective {
  /** `false` ignora o "-" (valores sempre positivos, como o de uma transação). */
  readonly allowNegative = input(true);

  constructor() {
    const input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;

    const mask = () => {
      const masked = applyMoneyMask(input.value, this.allowNegative());
      if (input.value !== masked) {
        input.value = masked;
      }
      // O valor cresce da direita para a esquerda, então o cursor fica sempre no fim.
      input.setSelectionRange(masked.length, masked.length);
    };

    // Na fase de captura, a máscara roda antes do listener do `[formField]`, que lê o valor já formatado.
    input.addEventListener('input', mask, { capture: true });
    inject(DestroyRef).onDestroy(() => input.removeEventListener('input', mask, { capture: true }));
  }
}
