import { Component, inject, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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

  protected readonly loginForm = form(signal(emptyLogin()), loginSchema);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
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
