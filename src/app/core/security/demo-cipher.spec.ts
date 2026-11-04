import { TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '../../../testing/test-providers';
import { base64ToBytes, bytesToBase64 } from '../../shared/utils/base64';
import { DecryptionFailedError, DemoCipher } from './demo-cipher';

describe('DemoCipher', () => {
  let cipher: DemoCipher;
  const passphrase = 'frase de teste';
  const text = 'Saldo fictício: R$ 1.234,56';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    cipher = TestBed.inject(DemoCipher);
  });

  it('encrypts and decrypts fictitious text with the same passphrase', async () => {
    const payload = await cipher.encrypt(passphrase, text);

    expect(payload).toMatchObject({ v: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256' });
    expect(base64ToBytes(payload.salt)).toHaveLength(16);
    expect(base64ToBytes(payload.iv)).toHaveLength(12);
    expect(payload.ciphertext).not.toContain('1.234');
    expect(JSON.stringify(payload)).not.toContain(passphrase);
    await expect(cipher.decrypt(passphrase, payload)).resolves.toBe(text);
  });

  it('generates a new salt and IV on every encryption', async () => {
    const first = await cipher.encrypt(passphrase, text);
    const second = await cipher.encrypt(passphrase, text);

    expect(second.salt).not.toBe(first.salt);
    expect(second.iv).not.toBe(first.iv);
    expect(second.ciphertext).not.toBe(first.ciphertext);
  });

  it('fails with a wrong passphrase', async () => {
    const payload = await cipher.encrypt(passphrase, text);

    await expect(cipher.decrypt('outra frase', payload)).rejects.toBeInstanceOf(
      DecryptionFailedError,
    );
  });

  it('detects tampered ciphertext and metadata', async () => {
    const payload = await cipher.encrypt(passphrase, text);
    const bytes = base64ToBytes(payload.ciphertext);
    bytes[0] ^= 0xff;

    for (const tampered of [
      { ...payload, ciphertext: bytesToBase64(bytes) },
      { ...payload, iv: bytesToBase64(new Uint8Array(12)) },
      { ...payload, salt: 'curto' },
      { ...payload, iterations: 1_000_000_000 },
      { ...payload, alg: 'AES-128-CBC' as never },
    ]) {
      await expect(cipher.decrypt(passphrase, tampered)).rejects.toBeInstanceOf(
        DecryptionFailedError,
      );
    }
  });

  it('stores nothing in the browser', async () => {
    localStorage.clear();
    sessionStorage.clear();

    const payload = await cipher.encrypt(passphrase, text);
    await cipher.decrypt(passphrase, payload);

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('requires a passphrase', async () => {
    await expect(cipher.encrypt('', text)).rejects.toBeInstanceOf(RangeError);
  });
});
