import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, TitleStrategy, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { PreferencesService } from './core/preferences/preferences.service';
import { problemDetailsInterceptor } from './core/interceptors/problem-details.interceptor';
import { requestIdInterceptor } from './core/interceptors/request-id.interceptor';
import { AppTitleStrategy } from './core/layout/app-title-strategy';
import { provideDataAccess } from './data-access/data-access.providers';

registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([requestIdInterceptor, problemDetailsInterceptor]),
    ),
    // Restaura a sessão antes da primeira navegação, para os guards já conhecerem o usuário.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    // Aplica tema e densidade salvos antes da primeira renderização.
    provideAppInitializer(() => void inject(PreferencesService)),
    provideDataAccess(),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
