/**
 * Registro ainda não gravado: sem `id` nem `createdAt`, que são definidos por quem grava. A API
 * gera os dois no servidor; as implementações locais (demo, JSON Server e testes) usam
 * `withIdentity`.
 */
export type NewRecord<T extends { id: string; createdAt: string }> = Omit<T, 'id' | 'createdAt'>;

/** Completa um registro novo com id e data de criação, como o servidor faria. */
export function withIdentity<T extends { id: string; createdAt: string }>(input: NewRecord<T>): T {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as T;
}
