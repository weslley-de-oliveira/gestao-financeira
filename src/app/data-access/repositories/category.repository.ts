import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Category } from '../../shared/models/category';

export type CategoryChanges = Partial<
  Omit<Category, 'id' | 'userId' | 'type' | 'createdAt' | 'updatedAt'>
>;

/** Contrato de acesso às categorias: na API (`data-access/api`) ou no `localStorage` (demo). */
export abstract class CategoryRepository {
  abstract listByUser(userId: string): Observable<Category[]>;

  /** Retorna `null` quando a categoria não existe. */
  abstract findById(id: string): Observable<Category | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(category: NewRecord<Category>): Observable<Category>;

  /** `version`: o `updatedAt` do registro quando o formulário o carregou (concorrência otimista). */
  abstract update(id: string, changes: CategoryChanges, version?: string): Observable<Category>;
}
