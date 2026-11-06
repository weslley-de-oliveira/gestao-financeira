import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { IncorrectPasswordError } from '../../../core/auth/auth.errors';
import { AuthService } from '../../../core/auth/auth.service';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../../../core/auth/forms/register.schema';
import {
  DecryptionFailedError,
  DemoCipher,
  EncryptedPayload,
} from '../../../core/security/demo-cipher';

export const PASSPHRASE_MIN_LENGTH = 8;
export const DEMO_TEXT_MAX_LENGTH = 500;

interface EncryptFormModel {
  passphrase: string;
  plaintext: string;
}

interface ChangePasswordModel {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const emptyPasswords = (): ChangePasswordModel => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

interface DecryptFormModel {
  passphrase: string;
  /** Payload em JSON, editável para demonstrar a detecção de alterações. */
  payload: string;
}

/**
 * Modo demonstrativo, troca de senha, laboratório de criptografia (AES-256-GCM + PBKDF2) e
 * exclusão da conta.
 * As frases ficam só no formulário, em memória, e são apagadas depois de cada operação.
 */
@Component({
  imports: [FormField, MatButtonModule, MatCardModule, MatFormFieldModule, MatIcon, MatInputModule],
  selector: 'app-security-page',
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage {
  private readonly cipher = inject(DemoCipher);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly user = this.auth.currentUser;
  protected readonly minLength = PASSPHRASE_MIN_LENGTH;

  private readonly encryptModel = signal<EncryptFormModel>({
    passphrase: '',
    plaintext: 'Saldo fictício da conta de teste: R$ 1.234,56',
  });
  protected readonly encryptForm = form(this.encryptModel, (p) => {
    required(p.passphrase, { message: 'Informe uma frase secreta de demonstração.' });
    minLength(p.passphrase, PASSPHRASE_MIN_LENGTH, {
      message: `Use pelo menos ${PASSPHRASE_MIN_LENGTH} caracteres.`,
    });
    required(p.plaintext, { message: 'Informe um texto fictício.' });
    maxLength(p.plaintext, DEMO_TEXT_MAX_LENGTH, {
      message: `O texto deve ter no máximo ${DEMO_TEXT_MAX_LENGTH} caracteres.`,
    });
  });
  protected readonly encrypted = signal<EncryptedPayload | null>(null);

  private readonly decryptModel = signal<DecryptFormModel>({ passphrase: '', payload: '' });
  protected readonly decryptForm = form(this.decryptModel, (p) => {
    required(p.passphrase, { message: 'Informe a frase secreta.' });
    required(p.payload, { message: 'Cole os dados criptografados.' });
  });
  protected readonly decrypted = signal<string | null>(null);
  protected readonly decryptError = signal<string | null>(null);

  /** Troca de senha: as mesmas regras do cadastro, e a nova diferente da atual. */
  private readonly passwordModel = signal(emptyPasswords());
  protected readonly passwordForm = form(this.passwordModel, (p) => {
    required(p.currentPassword, { message: 'Informe a senha atual.' });
    required(p.newPassword, { message: 'Informe a senha nova.' });
    minLength(p.newPassword, PASSWORD_MIN_LENGTH, {
      message: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    });
    pattern(p.newPassword, PASSWORD_PATTERN, {
      message: 'A senha deve conter pelo menos uma letra e um número.',
    });
    validate(p.newPassword, ({ value, valueOf }) =>
      value() && value() === valueOf(p.currentPassword)
        ? { kind: 'samePassword', message: 'A senha nova deve ser diferente da atual.' }
        : undefined,
    );
    required(p.confirmPassword, { message: 'Confirme a senha nova.' });
    validate(p.confirmPassword, ({ value, valueOf }) =>
      value() && value() !== valueOf(p.newPassword)
        ? { kind: 'passwordMismatch', message: 'As senhas não coincidem.' }
        : undefined,
    );
  });
  protected readonly passwordError = signal<string | null>(null);

  /** Confirmação da exclusão: o e-mail da conta, digitado, e a senha atual. */
  private readonly confirmation = signal({ email: '', password: '' });
  protected readonly confirmForm = form(this.confirmation);
  protected readonly canDelete = computed(
    () =>
      this.confirmation().email.trim().toLowerCase() === this.user()?.email &&
      this.confirmation().password.length > 0,
  );
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected async changePassword(event: Event): Promise<void> {
    event.preventDefault();
    this.passwordError.set(null);
    await submit(this.passwordForm, async (field) => {
      const { currentPassword, newPassword } = field().value();
      try {
        await this.auth.changePassword(currentPassword, newPassword);
      } catch (error) {
        if (error instanceof IncorrectPasswordError) {
          return {
            kind: 'incorrectPassword',
            message: 'Senha incorreta.',
            fieldTree: field.currentPassword,
          };
        }
        this.passwordError.set('Não foi possível trocar a senha. Tente novamente em instantes.');
        return undefined;
      }
      // As senhas não ficam no formulário depois de usadas.
      this.passwordForm().reset(emptyPasswords());
      this.snackBar.open(
        'Senha alterada. As sessões em outros aparelhos foram encerradas.',
        'Fechar',
        {
          duration: 5000,
        },
      );
      return undefined;
    });
  }

  protected async encrypt(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.encryptForm, async (field) => {
      const { passphrase, plaintext } = field().value();
      const payload = await this.cipher.encrypt(passphrase, plaintext);
      this.encrypted.set(payload);
      this.decrypted.set(null);
      this.decryptError.set(null);
      this.decryptForm().reset({ passphrase: '', payload: JSON.stringify(payload, null, 2) });
      // A frase não é guardada: some do formulário assim que é usada.
      this.encryptForm().reset({ passphrase: '', plaintext });
      return undefined;
    });
  }

  protected async decrypt(event: Event): Promise<void> {
    event.preventDefault();
    this.decrypted.set(null);
    this.decryptError.set(null);
    await submit(this.decryptForm, async (field) => {
      const { passphrase, payload } = field().value();
      let parsed: EncryptedPayload;
      try {
        parsed = JSON.parse(payload) as EncryptedPayload;
      } catch {
        this.decryptError.set('Os dados criptografados não estão no formato JSON esperado.');
        return undefined;
      }
      try {
        this.decrypted.set(await this.cipher.decrypt(passphrase, parsed));
      } catch (error) {
        if (!(error instanceof DecryptionFailedError)) {
          throw error;
        }
        // Mensagem genérica de propósito: não indica qual parte falhou.
        this.decryptError.set(
          'Não foi possível descriptografar: a frase está incorreta ou os dados foram alterados.',
        );
      }
      this.decryptForm().reset({ passphrase: '', payload });
      return undefined;
    });
  }

  protected async deleteAccount(): Promise<void> {
    if (!this.canDelete() || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set(null);
    try {
      await this.auth.deleteAccount(this.confirmation().password);
      await this.router.navigateByUrl('/login');
      this.snackBar.open('Conta e dados fictícios excluídos.', 'Fechar', { duration: 5000 });
    } catch (error) {
      if (error instanceof IncorrectPasswordError) {
        this.deleteError.set('Senha incorreta.');
        this.confirmation.update((value) => ({ ...value, password: '' }));
        return;
      }
      this.snackBar.open('Não foi possível excluir os dados. Tente novamente.', 'Fechar', {
        duration: 5000,
      });
    } finally {
      this.deleting.set(false);
    }
  }
}
