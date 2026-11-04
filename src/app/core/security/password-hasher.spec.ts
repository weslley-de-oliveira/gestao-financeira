import { TestBed } from '@angular/core/testing';
import { PBKDF2_ITERATIONS, PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  let hasher: PasswordHasher;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PBKDF2_ITERATIONS, useValue: 1_000 }],
    });
    hasher = TestBed.inject(PasswordHasher);
  });

  it('never stores the password in plain text', async () => {
    const stored = await hasher.hash('senha123');

    expect(JSON.stringify(stored)).not.toContain('senha123');
    expect(stored).toMatchObject({ algorithm: 'PBKDF2-SHA256', iterations: 1_000 });
  });

  it('uses a random salt for each hash', async () => {
    const first = await hasher.hash('senha123');
    const second = await hasher.hash('senha123');

    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const stored = await hasher.hash('senha123');

    await expect(hasher.verify('senha123', stored)).resolves.toBe(true);
    await expect(hasher.verify('senha124', stored)).resolves.toBe(false);
  });

  it('verifies with the iterations stored in the hash', async () => {
    const stored = await hasher.hash('senha123');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PBKDF2_ITERATIONS, useValue: 2_000 }],
    });

    await expect(TestBed.inject(PasswordHasher).verify('senha123', stored)).resolves.toBe(true);
  });
});
