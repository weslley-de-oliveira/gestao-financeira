const DEFAULT_URL = '/dashboard';

/** Aceita apenas caminhos internos, evitando redirecionamento para outros domínios. */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return DEFAULT_URL;
  }
  return url;
}
