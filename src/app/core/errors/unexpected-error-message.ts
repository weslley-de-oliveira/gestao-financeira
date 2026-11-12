import { requestIdOf } from '../interceptors/request-id.interceptor';

/** Caracteres do id da requisição mostrados na tela: bastam para achar o log. */
const CODE_LENGTH = 8;

/**
 * Mensagem de falha inesperada com o código do erro, quando ele veio de uma requisição à API:
 * "Não foi possível salvar a conta. Tente novamente em instantes. Código do erro: 3f9a1c2e." O
 * código é o começo do `X-Request-Id`, e a busca por ele nos logs da API encontra a requisição.
 */
export function unexpectedErrorMessage(message: string, error: unknown): string {
  const id = requestIdOf(error);
  return id ? `${message} Código do erro: ${id.slice(0, CODE_LENGTH)}.` : message;
}
