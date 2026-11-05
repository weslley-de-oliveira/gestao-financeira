/**
 * Ações sobre os dados da demonstração publicada, que ficam no navegador. Só é registrado na
 * build de demo: as telas o injetam com `{ optional: true }` e, sem ele, escondem essas ações.
 */
export abstract class DemoData {
  /** Apaga todos os dados locais (usuários incluídos) e volta ao seed inicial. */
  abstract restoreInitialData(): Promise<void>;
}
