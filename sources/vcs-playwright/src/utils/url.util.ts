import { AxiosResponse } from 'axios';

const END_SLASH_REGEX = /\/+$/;
const START_SLASH_REGEX = /^\/+/;
const NEXT_PAGE_LINK_REGEX = /<([^>]+)>;\s*rel="next"/;

export function getUrl(url: string, path?: string): URL {
  /**
   * Важно обращать внимание на слеш в конце базового пути и в начале относительного
   * new URL('d', 'https://a/b/c') → https://a/b/d
   * new URL('d', 'https://a/b/c/') → https://a/b/c/d
   * new URL('/d', 'https://a/b/c/') → https://a/d
   */
  if (!!path) {
    url = url.replace(END_SLASH_REGEX, '') + '/'; // В конце url всегда должен быть слеш
    path = path.replace(START_SLASH_REGEX, ''); // Слеш должен отсутствовать
    return new URL(path, url);
  }
  return new URL(url);
}
export function getHref(url: string, path?: string): string {
  return getUrl(url, path).href;
}

export function getPath(url: string, path?: string): string {
  return getUrl(url, path).pathname;
}

export function parseLinkNextUrl(response: AxiosResponse): string | undefined {
  const linkHeader = response.headers['link'];
  if (!!linkHeader) {
    const nextPageMatch = NEXT_PAGE_LINK_REGEX.exec(linkHeader);
    if (nextPageMatch) {
      return nextPageMatch[1];
    }
  }
  return;
}
