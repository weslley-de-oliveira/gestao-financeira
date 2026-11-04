import { Injectable, inject } from '@angular/core';
import { base64ToBytes, bytesToBase64 } from '../../shared/utils/base64';
import { PBKDF2_ITERATIONS } from './password-hasher';

/**
 * Resultado da criptografia: ciphertext e os metadados não secretos necessários para
 * descriptografar com a mesma frase. Nunca contém a frase nem a chave derivada.
 */
export interface EncryptedPayload {
  v: 1;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  /** Salt aleatório de 128 bits, em base64. */
  salt: string;
  /** IV aleatório de 96 bits, em base64. */
  iv: string;
  /** Ciphertext com a tag de autenticação do GCM, em base64. */
  ciphertext: string;
}

/** Falha genérica: não revela se a frase está errada ou se os dados foram alterados. */
export class DecryptionFailedError extends Error {
  constructor() {
    super('Decryption failed');
    this.name = 'DecryptionFailedError';
  }
}

export const DEMO_SALT_BYTES = 16;
export const DEMO_IV_BYTES = 12;
const MAX_DEMO_ITERATIONS = 2_000_000;

/**
 * Demonstração de criptografia no navegador (tela de Segurança): AES-256-GCM com chave derivada
 * da frase por PBKDF2-SHA256. Salt e IV novos a cada criptografia, então o IV nunca se repete com
 * a mesma chave. A chave é não exportável e só existe durante a operação; nada é armazenado.
 */
@Injectable({ providedIn: 'root' })
export class DemoCipher {
  private readonly iterations = inject(PBKDF2_ITERATIONS);

  async encrypt(passphrase: string, plaintext: string): Promise<EncryptedPayload> {
    assertPassphrase(passphrase);
    const salt = crypto.getRandomValues(new Uint8Array(DEMO_SALT_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(DEMO_IV_BYTES));
    const key = await deriveKey(passphrase, salt, this.iterations);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    return {
      v: 1,
      alg: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: this.iterations,
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
  }

  /** Lança `DecryptionFailedError` para frase incorreta, dados alterados ou metadados inválidos. */
  async decrypt(passphrase: string, payload: EncryptedPayload): Promise<string> {
    assertPassphrase(passphrase);
    try {
      if (payload.alg !== 'AES-256-GCM' || payload.kdf !== 'PBKDF2-SHA256') {
        throw new Error('Unsupported algorithm');
      }
      const iv = base64ToBytes(payload.iv);
      const salt = base64ToBytes(payload.salt);
      // O payload pode ser editado na tela: um número absurdo de iterações travaria a aba.
      if (
        iv.length !== DEMO_IV_BYTES ||
        salt.length !== DEMO_SALT_BYTES ||
        payload.iterations > MAX_DEMO_ITERATIONS
      ) {
        throw new Error('Invalid metadata');
      }
      const key = await deriveKey(passphrase, salt, payload.iterations);
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        base64ToBytes(payload.ciphertext),
      );
      return new TextDecoder().decode(plaintext);
    } catch {
      throw new DecryptionFailedError();
    }
  }
}

function assertPassphrase(passphrase: string): void {
  if (!passphrase) {
    throw new RangeError('Passphrase is required');
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    throw new RangeError('Invalid iterations');
  }
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
