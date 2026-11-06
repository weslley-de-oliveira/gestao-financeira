import { InjectionToken } from '@angular/core';

/**
 * URL base da API, na mesma origem do front: em desenvolvimento, o proxy do `ng serve`
 * (`proxy.conf.json`) encaminha `/api` para a API local.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => '/api/v1',
});
