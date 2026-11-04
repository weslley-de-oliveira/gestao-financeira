import { Injectable, InjectionToken, inject } from '@angular/core';
import { base64ToBytes, bytesToBase64 } from '../../shared/utils/base64';

/** Hash de senha armazenado no mock. Nunca contém a senha em texto puro. */
export interface PasswordHash {
  algorithm: 'PBKDF2-SHA256';
  iterations: number;
  /** Salt aleatório em base64. */
  salt: string;
  /** Hash derivado em base64. */
  hash: string;
}

/** Recomendação da OWASP (2023) para PBKDF2-HMAC-SHA256. */
export const PBKDF2_ITERATIONS = new InjectionToken<number>('PBKDF2_ITERATIONS', {
  factory: () => 600_000,
});

const SALT_BYTES = 16;
const HASH_BITS = 256;

/**
 * Hash de senhas para a autenticação demonstrativa no navegador.
 * Em produção, o hash deve ser feito no backend com um algoritmo como Argon2id.
 */
@Injectable({ providedIn: 'root' })
export class PasswordHasher {
  private readonly iterations = inject(PBKDF2_ITERATIONS);

  async hash(password: string): Promise<PasswordHash> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hash = await this.derive(password, salt, this.iterations);
    return {
      algorithm: 'PBKDF2-SHA256',
      iterations: this.iterations,
      salt: bytesToBase64(salt),
      hash: bytesToBase64(hash),
    };
  }

  async verify(password: string, stored: PasswordHash): Promise<boolean> {
    const expected = base64ToBytes(stored.hash);
    const actual = await this.derive(password, base64ToBytes(stored.salt), stored.iterations);
    return constantTimeEqual(expected, actual);
  }

  private async derive(
    password: string,
    salt: Uint8Array<ArrayBuffer>,
    iterations: number,
  ): Promise<Uint8Array> {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      material,
      HASH_BITS,
    );
    return new Uint8Array(bits);
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
