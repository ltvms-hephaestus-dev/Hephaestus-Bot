/** Every internal link goes through here so the site works under any base path. */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');

export function url(path = ''): string {
  return `${BASE}/${path.replace(/^\/+/, '')}`;
}

export const BASE_PATH = BASE;
