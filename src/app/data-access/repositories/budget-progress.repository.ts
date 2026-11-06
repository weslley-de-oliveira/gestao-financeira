import { Observable } from 'rxjs';
import { BudgetProgress } from '../../shared/models/budget';
import { IsoMonth } from '../../shared/utils/month';

/**
 * Consumo dos orçamentos num mês: na API, calculado pelo servidor; na demonstração e nos testes,
 * por `budgetProgress` sobre as transações locais.
 */
export abstract class BudgetProgressRepository {
  /** Os orçamentos do usuário que valem no mês, com o gasto, o previsto e a situação. */
  abstract listByMonth(userId: string, month: IsoMonth): Observable<BudgetProgress[]>;
}
