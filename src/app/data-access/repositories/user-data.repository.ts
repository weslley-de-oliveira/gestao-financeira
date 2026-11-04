import { Observable } from 'rxjs';

/**
 * Operações sobre todos os dados de um usuário. Fica fora dos contratos de cada entidade, que não
 * oferecem exclusão (contas, categorias, cartões e metas só são arquivados).
 */
export abstract class UserDataRepository {
  /** Apaga o usuário e tudo o que pertence a ele: transações, orçamentos, metas, cartões etc. */
  abstract deleteAllForUser(userId: string): Observable<void>;
}
