import { Auth, AxiosClientOptions, AxiosWrapper, RequestClientOptions, RequestWrapper } from '@vcs-pw/api/base';
import { config } from '@vcs-pw/config';

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

export class BackApi extends AxiosWrapper {
  constructor({ baseUrl, path, auth, timeout }: AxiosClientOptions) {
    super({ baseUrl, path, timeout });
    this.configure(auth);
  }

  // Статические методы ниже для удобства использования в коде тестов для API SC.
  // Cоздание экземпляра с токеном (token)
  static withToken<C extends BackApi>(
    this: new (options: AxiosClientOptions) => C,
    token: string,
    options?: Partial<Omit<AxiosClientOptions, 'auth'>>,
  ): C {
    const auth: Auth = {
      token: {
        type: 'token',
        value: token,
      },
    };
    return new this({
      baseUrl: config.api.baseUrl,
      auth,
      ...options,
    });
  }

  // Cоздание экземпляра с базовой аутентификацией
  static withBasic<C extends BackApi>(
    this: new (options: AxiosClientOptions) => C,
    user: NonNullable<Auth['user']>,
    options?: Partial<Omit<AxiosClientOptions, 'auth'>>,
  ): C {
    const auth: Auth = {
      user,
    };
    return new this({
      baseUrl: config.api.basicAuthBaseUrl,
      auth,
      ...options,
    });
  }

  static anonymous<C extends BackApi>(
    this: new (options: AxiosClientOptions) => C,
    options?: Partial<Omit<AxiosClientOptions, 'auth'>>,
  ): C {
    return new this({
      baseUrl: config.api.baseUrl,
      ...options,
    });
  }

  private configure(auth?: Auth) {
    if (!!auth) {
      if (!!auth.token) {
        this.client.defaults.headers.common['Authorization'] = `${auth.token.type} ${auth.token.value}`;
      } else if (!!auth.user) {
        this.client.defaults.auth = {
          username: auth.user.name,
          password: auth.user.password,
        };
      }
    }
  }

  protected getSudoHeader(username: string): Record<string, string> {
    return { Sudo: username };
  }
}

export class OldWebApi extends RequestWrapper {
  constructor({ client, baseUrl, path, timeout }: RequestClientOptions) {
    super({ client, baseUrl, path, timeout });
  }

  static withRequest<C extends OldWebApi>(
    this: new (options: RequestClientOptions) => C,
    client: RequestClientOptions['client'],
    options?: Partial<Omit<RequestClientOptions, 'client' | 'baseUrl'>>,
  ): C {
    return new this({
      client,
      baseUrl: config.ui.proxiedBaseUrl,
      ...options,
    });
  }

  private async getCsrfCookieValue(): Promise<string> {
    const state = await this.client.storageState();
    const value = state.cookies.find((cookie) => cookie.name === CSRF_COOKIE_NAME)?.value;
    if (!value) {
      throw new Error(`Куки '${CSRF_COOKIE_NAME}' отсутствует с контексте запроса`);
    }
    return value;
  }

  protected async csrfParam(): Promise<{ [CSRF_COOKIE_NAME]: string }> {
    const csrfValue = await this.getCsrfCookieValue();
    return { [CSRF_COOKIE_NAME]: csrfValue };
  }

  protected async csrfHeader(): Promise<{ [CSRF_HEADER_NAME]: string }> {
    const csrfValue = await this.getCsrfCookieValue();
    return { [CSRF_HEADER_NAME]: csrfValue };
  }

  protected toCheckboxValue(param: boolean | null | undefined): string | undefined {
    return param ? 'on' : undefined;
  }
}

export class ReactWebApi extends RequestWrapper {
  constructor({ client, baseUrl, path, timeout }: RequestClientOptions) {
    super({ client, baseUrl, path, timeout });
  }

  static withRequest<C extends ReactWebApi>(
    this: new (options: RequestClientOptions) => C,
    client: RequestClientOptions['client'],
    options?: Partial<Omit<RequestClientOptions, 'client' | 'baseUrl'>>,
  ): C {
    return new this({
      client,
      baseUrl: config.ui.reactApiBaseUrl,
      ...options,
    });
  }
}

export const isStatus =
  (expected: number) =>
  (status: number): boolean =>
    status === expected;

export { HttpStatusCode } from 'axios';
export type { AxiosClientOptions, RequestClientOptions };
