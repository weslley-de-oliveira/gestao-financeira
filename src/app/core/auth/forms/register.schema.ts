import {
  email,
  maxLength,
  minLength,
  pattern,
  required,
  schema,
  validate,
} from '@angular/forms/signals';

export interface RegisterModel {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const emptyRegister = (): RegisterModel => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
});

export const NAME_MAX_LENGTH = 80;
export const PASSWORD_MIN_LENGTH = 8;

/** Ao menos uma letra e um número. */
const PASSWORD_PATTERN = /^(?=.*\p{L})(?=.*\d).+$/u;

export const registerSchema = schema<RegisterModel>((p) => {
  required(p.name, { message: 'Informe o nome.' });
  maxLength(p.name, NAME_MAX_LENGTH, {
    message: `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
  });

  required(p.email, { message: 'Informe o e-mail.' });
  email(p.email, { message: 'Informe um e-mail válido.' });

  required(p.password, { message: 'Informe a senha.' });
  minLength(p.password, PASSWORD_MIN_LENGTH, {
    message: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  });
  pattern(p.password, PASSWORD_PATTERN, {
    message: 'A senha deve conter pelo menos uma letra e um número.',
  });

  required(p.confirmPassword, { message: 'Confirme a senha.' });
  validate(p.confirmPassword, ({ value, valueOf }) =>
    value() && value() !== valueOf(p.password)
      ? { kind: 'passwordMismatch', message: 'As senhas não coincidem.' }
      : undefined,
  );
});
