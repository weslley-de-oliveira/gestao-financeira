import { Observable } from 'rxjs';
import { DashboardData } from '../../shared/models/dashboard';
import { DateRange } from '../../shared/models/period';

/** Quantidade de transações recentes do dashboard (a mesma da API). */
export const DASHBOARD_RECENT_LIMIT = 5;

/** Quantidade de orçamentos e de metas em destaque (a mesma da API). */
export const DASHBOARD_HIGHLIGHTS = 3;

/**
 * Contrato do resumo do dashboard: na API, uma chamada só (`GET /v1/dashboard`), sem baixar as
 * transações; na demo e nos testes, calculado no navegador pelas mesmas regras.
 */
export abstract class DashboardRepository {
  abstract load(userId: string, range: DateRange): Observable<DashboardData>;
}
