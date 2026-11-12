import { Component, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit, validate } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { confirmRestoreDemoData } from '../../../core/demo/restore-demo-data';
import {
  ACCENT_OPTIONS,
  AccentPreference,
  DensityPreference,
  PreferencesService,
  ThemePreference,
} from '../../../core/preferences/preferences.service';
import { DemoData } from '../../../data-access/repositories/demo-data';
import { USER_NAME_MAX_LENGTH } from '../../../shared/models/user';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { unexpectedErrorMessage } from '../../../core/errors/unexpected-error-message';

interface ProfileFormModel {
  name: string;
}

/**
 * Perfil, preferências visuais (locais ao navegador), regionais fixas, dados da demo publicada e
 * encerrar sessão.
 */
@Component({
  imports: [
    FormField,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MoneyPipe,
  ],
  selector: 'app-settings-page',
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly preferences = inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  /** Presente só na demo publicada (dados no navegador). */
  protected readonly demoData = inject(DemoData, { optional: true });

  protected readonly user = this.auth.currentUser;
  protected readonly theme = this.preferences.theme;
  protected readonly density = this.preferences.density;
  protected readonly accent = this.preferences.accent;
  protected readonly accentOptions = ACCENT_OPTIONS;

  private readonly profile = signal<ProfileFormModel>({ name: this.user()?.name ?? '' });
  protected readonly profileForm = form(this.profile, (p) => {
    required(p.name, { message: 'Informe o nome.' });
    validate(p.name, ({ value }) =>
      value() && !value().trim() ? { kind: 'blank', message: 'Informe o nome.' } : undefined,
    );
    maxLength(p.name, USER_NAME_MAX_LENGTH, {
      message: `O nome deve ter no máximo ${USER_NAME_MAX_LENGTH} caracteres.`,
    });
  });
  protected readonly profileError = signal<string | null>(null);

  /** Exemplo do formato monetário fixo: R$ 1.234,56. */
  protected readonly moneySample = 123_456;

  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    this.profileError.set(null);
    await submit(this.profileForm, async (field) => {
      try {
        const user = await this.auth.updateName(field.name().value());
        this.profile.set({ name: user.name });
        this.notify('Perfil atualizado.');
      } catch (error) {
        this.profileError.set(
          unexpectedErrorMessage(
            'Não foi possível salvar o perfil. Tente novamente em instantes.',
            error,
          ),
        );
      }
      return undefined;
    });
  }

  protected setTheme(theme: ThemePreference): void {
    this.preferences.setTheme(theme);
  }

  protected setAccent(accent: AccentPreference): void {
    this.preferences.setAccent(accent);
  }

  protected setDensity(density: DensityPreference): void {
    this.preferences.setDensity(density);
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
    this.notify('Sessão encerrada.');
  }

  protected async restoreDemoData(): Promise<void> {
    if (this.demoData && (await confirmRestoreDemoData(this.dialog, this.demoData))) {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
      this.notify('Dados da demonstração restaurados.');
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 4000 });
  }
}
