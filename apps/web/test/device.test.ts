import { isPhone } from '../src/device';

const DESKTOP_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

const media = (matches: boolean) => () => ({ matches });

describe('isPhone — detecção de celular', () => {
  it('iPhone e Android são celular (sucesso)', () => {
    expect(isPhone(IPHONE_UA, media(false))).toBe(true);
    expect(isPhone(ANDROID_UA, media(false))).toBe(true);
  });

  it('computador nunca é celular, mesmo com a janela estreita (sucesso)', () => {
    expect(isPhone(DESKTOP_UA, media(false))).toBe(false);
  });

  it('tela de toque pequena sem user agent conhecido conta como celular (borda)', () => {
    expect(isPhone(DESKTOP_UA, media(true))).toBe(true);
  });

  it('sem matchMedia disponível decide só pelo user agent (erro)', () => {
    expect(isPhone(DESKTOP_UA, undefined)).toBe(false);
    expect(isPhone(IPHONE_UA, undefined)).toBe(true);
  });
});
