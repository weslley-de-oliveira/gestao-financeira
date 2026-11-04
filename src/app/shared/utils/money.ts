/** Valores monetários circulam como centavos inteiros (R$ 1.234,56 → 123456), nunca como reais em ponto flutuante. */
export type Cents = number;

/** Maior valor absoluto aceito nos formulários: R$ 1 bilhão. */
export const MAX_MONEY_CENTS: Cents = 100_000_000_000;

export function isValidCents(value: unknown): value is Cents {
  return Number.isSafeInteger(value);
}

/** Garante que um valor recebido é um inteiro de centavos válido (finito, sem fração). */
export function assertValidCents(value: unknown, field = 'value'): asserts value is Cents {
  if (!isValidCents(value)) {
    throw new RangeError(`${field} must be an integer amount of cents`);
  }
}

/** Valores digitados no padrão brasileiro: "1.234,56", "1234,5", "-10" ou "R$ 7,00". */
const MONEY_INPUT_PATTERN = /^(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/** Converte o texto digitado em centavos; retorna `null` se o formato for inválido. */
export function parseMoney(text: string): Cents | null {
  const match = MONEY_INPUT_PATTERN.exec(text.replace(/^\s*(-)?\s*R\$\s*/, '$1').trim());
  if (!match) {
    return null;
  }
  const [, sign, integerPart, decimalPart = ''] = match;
  const cents = Number(integerPart.replaceAll('.', '')) * 100 + Number(decimalPart.padEnd(2, '0'));
  if (!isValidCents(cents)) {
    return null;
  }
  return sign && cents !== 0 ? -cents : cents;
}

/** Formata centavos para edição em um campo de texto: 123456 → "1.234,56". */
export function formatMoneyInput(cents: Cents, negative = cents < 0): string {
  const absolute = Math.abs(cents);
  const reais = String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const remainder = String(absolute % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${reais},${remainder}`;
}

/** Dígitos aceitos pela máscara: até R$ 9.999.999.999,99 (o schema limita a R$ 1 bilhão). */
const MONEY_MASK_MAX_DIGITS = 12;

/**
 * Máscara de moeda em que os dígitos entram pela direita: digitar "1", "2", "3" resulta em
 * "0,01", "0,12", "1,23". Digitar "-" alterna o sinal. Sem dígitos, o campo fica vazio.
 */
export function applyMoneyMask(text: string): string {
  const digits = text.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  const significant = digits.replace(/^0+/, '').slice(0, MONEY_MASK_MAX_DIGITS);
  // Cada "-" digitado alterna o sinal do valor que já estava no campo.
  const negative = (text.match(/-/g)?.length ?? 0) % 2 === 1;
  return formatMoneyInput(Number(significant || '0'), negative);
}
