import { TestBed } from '@angular/core/testing';
import { EncryptedSessionStorage } from './encrypted-session-storage';

describe('EncryptedSessionStorage', () => {
  let storage: EncryptedSessionStorage;
  const value = { id: 'u1', name: 'Ana Teste', email: 'ana@exemplo.com' };

  beforeEach(() => {
    sessionStorage.clear();
    storage = TestBed.inject(EncryptedSessionStorage);
  });

  it('stores an encrypted value that can be read back', async () => {
    await storage.setItem('session', value);

    const raw = sessionStorage.getItem('session') ?? '';
    expect(raw).not.toContain('Ana Teste');
    expect(raw).not.toContain('ana@exemplo.com');
    expect(JSON.parse(raw)).toMatchObject({ v: 1, alg: 'AES-256-GCM' });
    await expect(storage.getItem('session')).resolves.toEqual(value);
  });

  it('uses a different IV for each encryption', async () => {
    await storage.setItem('session', value);
    const first = JSON.parse(sessionStorage.getItem('session')!);
    await storage.setItem('session', value);
    const second = JSON.parse(sessionStorage.getItem('session')!);

    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it('returns null and discards a tampered value', async () => {
    await storage.setItem('session', value);
    const entry = JSON.parse(sessionStorage.getItem('session')!);
    const tampered = (entry.data[0] === 'A' ? 'B' : 'A') + entry.data.slice(1);
    sessionStorage.setItem('session', JSON.stringify({ ...entry, data: tampered }));

    await expect(storage.getItem('session')).resolves.toBeNull();
    expect(sessionStorage.getItem('session')).toBeNull();
  });

  it('invalidates the stored value when the item is removed', async () => {
    await storage.setItem('session', value);
    const copy = sessionStorage.getItem('session')!;

    await storage.removeItem('session');
    sessionStorage.setItem('session', copy);

    await expect(storage.getItem('session')).resolves.toBeNull();
  });
});
