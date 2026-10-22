type MatchMedia = (query: string) => { matches: boolean };

const PHONE_UA = /Android.*Mobile|iPhone|iPod|Windows Phone|Mobile Safari/i;

/** Celular ganha o layout mobile; computador fica sempre no layout de computador, mesmo com janela estreita. */
export function isPhone(
  ua: string = navigator.userAgent,
  matchMedia: MatchMedia | undefined = window.matchMedia?.bind(window),
): boolean {
  if (PHONE_UA.test(ua)) return true;
  return matchMedia?.('(pointer: coarse) and (max-width: 820px)').matches ?? false;
}
