import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps internal paths', () => {
    expect(safeReturnUrl('/accounts?type=savings')).toBe('/accounts?type=savings');
  });

  it.each([null, undefined, '', 'https://exemplo.com', '//exemplo.com', '/\\exemplo.com'])(
    'falls back to the dashboard for %s',
    (url) => {
      expect(safeReturnUrl(url)).toBe('/dashboard');
    },
  );
});
