import { Injectable, inject } from '@angular/core';
import { base64ToBytes, bytesToBase64 } from '../../shared/utils/base64';
import { SessionKeyStore } from './session-key-store';

interface EncryptedEntry {
  v: 1;
  alg: 'AES-256-GCM';
  /** IV de 96 bits, único por criptografia, em base64. */
  iv: string;
  /** Ciphertext com a tag de autenticação do GCM, em base64. */
  data: string;
}

const IV_BYTES = 12;

/**
 * `sessionStorage` com valores criptografados (AES-256-GCM).
 * Impede a leitura casual dos dados no DevTools, mas não protege contra XSS:
 * um script executado na página pode usar a mesma chave.
 */
@Injectable({ providedIn: 'root' })
export class EncryptedSessionStorage {
  private readonly keyStore = inject(SessionKeyStore);

  async setItem<T>(name: string, value: T): Promise<void> {
    const key = await this.keyStore.getOrCreate();
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    const entry: EncryptedEntry = {
      v: 1,
      alg: 'AES-256-GCM',
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(ciphertext)),
    };
    sessionStorage.setItem(name, JSON.stringify(entry));
  }

  /** Retorna `null` se o item não existir ou não puder ser descriptografado (o item é removido). */
  async getItem<T>(name: string): Promise<T | null> {
    const raw = sessionStorage.getItem(name);
    if (raw === null) {
      return null;
    }
    try {
      const key = await this.keyStore.load();
      if (!key) {
        throw new Error('Session key not found');
      }
      const entry = JSON.parse(raw) as EncryptedEntry;
      const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: base64ToBytes(entry.iv) },
        key,
        base64ToBytes(entry.data),
      );
      return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    } catch {
      sessionStorage.removeItem(name);
      return null;
    }
  }

  /** Remove o item e descarta a chave, invalidando qualquer cópia do ciphertext. */
  async removeItem(name: string): Promise<void> {
    sessionStorage.removeItem(name);
    await this.keyStore.clear();
  }
}
