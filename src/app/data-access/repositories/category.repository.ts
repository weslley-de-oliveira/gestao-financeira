import { NewRecord } from './new-record';
import { Observable } from 'rxjs';
import { Category } from '../../shared/models/category';

export type CategoryChanges = Partial<Omit<Category, 'id' | 'userId' | 'type' | 'createdAt'>>;

/** Contrato de acesso às categorias. A implementação atual usa HTTP (JSON Server). */
export abstract class CategoryRepository {
  abstract listByUser(userId: string): Observable<Category[]>;

  /** Retorna `null` quando a categoria não existe. */
  abstract findById(id: string): Observable<Category | null>;

  /** Grava o registro novo; o id e a data de criação são definidos ao gravar. */
  abstract create(category: NewRecord<Category>): Observable<Category>;

  abstract update(id: string, changes: CategoryChanges): Observable<Category>;
}
