import { NewRecord, withIdentity } from '../repositories/new-record';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CreditCard } from '../../shared/models/credit-card';
import { toCreditCard, toCreditCardDto } from './dto/credit-card.dto';
import { CreditCardChanges, CreditCardRepository } from '../repositories/credit-card.repository';
import { LocalCollection, LocalDatabase } from './local-database';

/** Cartões de crédito da demonstração, no `localStorage`. */
@Injectable()
export class LocalCreditCardRepository extends CreditCardRepository {
  private readonly creditCards = new LocalCollection(inject(LocalDatabase), 'creditCards');

  listByUser(userId: string): Observable<CreditCard[]> {
    return this.creditCards.listByUser(userId).pipe(map((records) => records.map(toCreditCard)));
  }

  findById(id: string): Observable<CreditCard | null> {
    return this.creditCards.findById(id).pipe(map((dto) => (dto ? toCreditCard(dto) : null)));
  }

  create(input: NewRecord<CreditCard>): Observable<CreditCard> {
    const card = withIdentity<CreditCard>(input);
    return this.creditCards.insert(toCreditCardDto(card)).pipe(map(toCreditCard));
  }

  update(id: string, changes: CreditCardChanges): Observable<CreditCard> {
    return this.creditCards.patch(id, changes).pipe(map(toCreditCard));
  }
}
