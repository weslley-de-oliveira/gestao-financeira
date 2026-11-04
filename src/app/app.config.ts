import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
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
import { AppTitleStrategy } from './core/layout/app-title-strategy';
import { AccountRepository } from './data-access/repositories/account.repository';
import { CategoryRepository } from './data-access/repositories/category.repository';
import { CreditCardRepository } from './data-access/repositories/credit-card.repository';
import { HttpAccountRepository } from './data-access/repositories/http-account.repository';
import { HttpCategoryRepository } from './data-access/repositories/http-category.repository';
import { HttpCreditCardRepository } from './data-access/repositories/http-credit-card.repository';
import { HttpTransactionRepository } from './data-access/repositories/http-transaction.repository';
import { HttpUserRepository } from './data-access/repositories/http-user.repository';
import { TransactionRepository } from './data-access/repositories/transaction.repository';
import { UserRepository } from './data-access/repositories/user.repository';

registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
    // Restaura a sessão antes da primeira navegação, para os guards já conhecerem o usuário.
    provideAppInitializer(() => inject(AuthService).restoreSession()),
    { provide: UserRepository, useClass: HttpUserRepository },
    { provide: AccountRepository, useClass: HttpAccountRepository },
    { provide: CategoryRepository, useClass: HttpCategoryRepository },
    { provide: TransactionRepository, useClass: HttpTransactionRepository },
    { provide: CreditCardRepository, useClass: HttpCreditCardRepository },
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } },
  ],
};
