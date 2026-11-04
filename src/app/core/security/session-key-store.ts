import { Injectable } from '@angular/core';

const DB_NAME = 'gestao-financeira';
const STORE_NAME = 'keys';
const KEY_ID = 'session';

/**
 * Guarda a chave AES da sessão no IndexedDB como `CryptoKey` não exportável:
 * a chave pode ser usada pela aplicação, mas seus bytes nunca ficam acessíveis ao JavaScript.
 * Sem IndexedDB disponível, a chave fica apenas em memória.
 */
@Injectable({ providedIn: 'root' })
export class SessionKeyStore {
  private memoryKey: CryptoKey | null = null;

  async getOrCreate(): Promise<CryptoKey> {
    const existing = await this.load();
    if (existing) {
      return existing;
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await this.save(key);
    return key;
  }

  async load(): Promise<CryptoKey | null> {
    if (!hasIndexedDb()) {
      return this.memoryKey;
    }
    const db = await openDatabase();
    try {
      return (
        (await request(db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY_ID))) ?? null
      );
    } finally {
      db.close();
    }
  }

  async clear(): Promise<void> {
    this.memoryKey = null;
    if (!hasIndexedDb()) {
      return;
    }
    const db = await openDatabase();
    try {
      await request(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(KEY_ID));
    } finally {
      db.close();
    }
  }

  private async save(key: CryptoKey): Promise<void> {
    if (!hasIndexedDb()) {
      this.memoryKey = key;
      return;
    }
    const db = await openDatabase();
    try {
      await request(
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(key, KEY_ID),
      );
    } finally {
      db.close();
    }
  }
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  const open = indexedDB.open(DB_NAME, 1);
  open.onupgradeneeded = () => open.result.createObjectStore(STORE_NAME);
  return request(open);
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
