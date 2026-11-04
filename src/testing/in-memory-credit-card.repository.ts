import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  CreditCardChanges,
  CreditCardRepository,
} from '../app/data-access/repositories/credit-card.repository';
import { CreditCard } from '../app/shared/models/credit-card';

/** Repositório de cartões em memória, para testes sem JSON Server. */
@Injectable()
export class InMemoryCreditCardRepository extends CreditCardRepository {
  readonly records: CreditCard[] = [];

  listByUser(userId: string): Observable<CreditCard[]> {
    return of(this.records.filter((card) => card.userId === userId).map(clone));
  }

  findById(id: string): Observable<CreditCard | null> {
    const card = this.records.find((record) => record.id === id);
    return of(card ? clone(card) : null);
  }

  create(card: CreditCard): Observable<CreditCard> {
    this.records.push(clone(card));
    return of(clone(card));
  }

  update(id: string, changes: CreditCardChanges): Observable<CreditCard> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return throwError(() => new Error(`Credit card ${id} not found`));
    }
    this.records[index] = { ...this.records[index], ...changes };
    return of(clone(this.records[index]));
  }
}

function clone(card: CreditCard): CreditCard {
  return { ...card };
}
