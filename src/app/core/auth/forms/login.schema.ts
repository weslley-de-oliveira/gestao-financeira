import { email, required, schema } from '@angular/forms/signals';

export interface LoginModel {
  email: string;
  password: string;
}

export const emptyLogin = (): LoginModel => ({ email: '', password: '' });

export const loginSchema = schema<LoginModel>((p) => {
  required(p.email, { message: 'Informe o e-mail.' });
  email(p.email, { message: 'Informe um e-mail válido.' });
  required(p.password, { message: 'Informe a senha.' });
});
