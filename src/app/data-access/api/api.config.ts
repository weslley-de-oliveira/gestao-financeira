import { InjectionToken } from '@angular/core';

/** URL base da API. Em desenvolvimento, o JSON Server (`npm run start:api`). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => 'http://localhost:3000',
});
