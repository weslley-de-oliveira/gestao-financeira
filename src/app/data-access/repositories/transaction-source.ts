import { Observable } from 'rxjs';
import { Transaction } from '../../shared/models/transaction';

/**
 * Todas as transações do usuário, para os cálculos feitos no navegador: saldos, faturas, consumo
 * dos orçamentos e dashboard da demonstração e dos testes. A build publicada não registra este
 * contrato: lá, a API calcula tudo e a lista completa nunca é baixada.
 */
export abstract class TransactionSource {
  abstract listByUser(userId: string): Observable<Transaction[]>;
}
