/**
 * Espera para operações da Web Crypto (hash PBKDF2), que rodam fora do controle do Angular.
 * O padrão de 1 s do `vi.waitFor` não basta com a suíte inteira rodando em paralelo.
 */
export const CRYPTO_WAIT = { timeout: 5_000 };
