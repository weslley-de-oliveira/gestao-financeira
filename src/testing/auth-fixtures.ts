import { TestBed } from '@angular/core/testing';
import { AuthService } from '../app/core/auth/auth.service';

/** Cadastra e autentica a usuária fictícia usada nos testes; retorna o id dela. */
export async function signInTestUser(): Promise<string> {
  const auth = TestBed.inject(AuthService);
  await auth.register({ name: 'Ana Teste', email: 'ana@exemplo.com', password: 'senha123' });
  return auth.currentUser()?.id ?? '';
}
