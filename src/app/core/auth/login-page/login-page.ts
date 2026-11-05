import { Component, inject, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DEMO_CREDENTIALS } from '../../../data-access/local/demo-credentials';
import { DemoData } from '../../../data-access/repositories/demo-data';
import { confirmRestoreDemoData } from '../../demo/restore-demo-data';
import { InvalidCredentialsError } from '../auth.errors';
import { AuthService } from '../auth.service';
import { emptyLogin, loginSchema } from '../forms/login.schema';
import { safeReturnUrl } from '../return-url';

@Component({
  imports: [FormField, RouterLink, MatButtonModule, MatFormFieldModule, MatIcon, MatInputModule],
  selector: 'app-login-page',
  templateUrl: './login-page.html',
  styleUrl: '../auth-form.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  /** Presente só na demo publicada (dados no navegador). */
  protected readonly demoData = inject(DemoData, { optional: true });
  protected readonly demoCredentials = DEMO_CREDENTIALS;

  private readonly credentials = signal(emptyLogin());
  protected readonly loginForm = form(this.credentials, loginSchema);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    await this.authenticate();
  }

  protected async loginAsDemo(): Promise<void> {
    this.credentials.set({ ...DEMO_CREDENTIALS });
    await this.authenticate();
  }

  protected async restoreDemoData(): Promise<void> {
    if (this.demoData && (await confirmRestoreDemoData(this.dialog, this.demoData))) {
      this.snackBar.open('Dados da demonstração restaurados.', 'Fechar', { duration: 4000 });
    }
  }

  private async authenticate(): Promise<void> {
    this.errorMessage.set(null);

    await submit(this.loginForm, async (field) => {
      try {
        await this.auth.login(field().value());
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        await this.router.navigateByUrl(safeReturnUrl(returnUrl));
      } catch (error) {
        this.errorMessage.set(
          error instanceof InvalidCredentialsError
            ? 'E-mail ou senha inválidos.'
            : 'Não foi possível entrar agora. Tente novamente em instantes.',
        );
      }
      return undefined;
    });
  }
}
