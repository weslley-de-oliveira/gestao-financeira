import { Component, inject, signal } from '@angular/core';
import { FormField, form, submit } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { EmailAlreadyRegisteredError } from '../auth.errors';
import { AuthService } from '../auth.service';
import { PASSWORD_MIN_LENGTH, emptyRegister, registerSchema } from '../forms/register.schema';

@Component({
  imports: [FormField, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  selector: 'app-register-page',
  templateUrl: './register-page.html',
  styleUrl: '../auth-form.scss',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly registerForm = form(signal(emptyRegister()), registerSchema);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    await submit(this.registerForm, async (field) => {
      const { name, email, password } = field().value();
      try {
        await this.auth.register({ name, email, password });
      } catch (error) {
        if (error instanceof EmailAlreadyRegisteredError) {
          return {
            kind: 'emailTaken',
            message: 'Este e-mail já está cadastrado.',
            fieldTree: field.email,
          };
        }
        this.errorMessage.set(
          'Não foi possível criar a conta agora. Tente novamente em instantes.',
        );
        return undefined;
      }
      this.snackBar.open(`Conta criada. Boas-vindas, ${name.trim()}!`, 'Fechar', {
        duration: 5000,
      });
      await this.router.navigateByUrl('/dashboard');
      return undefined;
    });
  }
}
