import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../api/api.config';
import { UserDataRepository } from './user-data.repository';

/**
 * Coleções com `userId`, na ordem de exclusão: dependentes primeiro. O JSON Server também apaga
 * dependentes em cascata (por exemplo, as transações de uma conta); por isso um 404 é tolerado.
 */
const USER_COLLECTIONS = [
  'transactions',
  'budgets',
  'goals',
  'creditCards',
  'categories',
  'accounts',
] as const;

@Injectable()
export class HttpUserDataRepository extends UserDataRepository {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  deleteAllForUser(userId: string): Observable<void> {
    return defer(() => this.deleteAll(userId));
  }

  private async deleteAll(userId: string): Promise<void> {
    for (const collection of USER_COLLECTIONS) {
      const records = await firstValueFrom(
        this.http.get<{ id: string }[]>(`${this.baseUrl}/${collection}`, { params: { userId } }),
      );
      for (const { id } of records) {
        await this.delete(`${this.baseUrl}/${collection}/${encodeURIComponent(id)}`);
      }
    }
    await this.delete(`${this.baseUrl}/users/${encodeURIComponent(userId)}`);
  }

  private async delete(url: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(url));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound)) {
        throw error;
      }
    }
  }
}
