/** O registro mudou desde que o formulário o carregou (API respondeu 412 ao `If-Match`). */
export class StaleRecordError extends Error {
  constructor() {
    super('The record changed since it was loaded');
    this.name = 'StaleRecordError';
  }
}

export const STALE_RECORD_MESSAGE =
  'Este registro foi alterado em outra aba ou aparelho. Recarregue a página para ver a versão atual e refaça a alteração.';
