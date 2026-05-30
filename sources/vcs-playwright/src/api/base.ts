import { APIRequestContext, APIResponse } from '@playwright/test';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { applyAllureInterceptor } from '@vcs-pw/api/interceptors/allure.interceptor';
import { applyLoggerInterceptor, logError, logRequest, logResponse } from '@vcs-pw/api/interceptors/logger.interceptor';
import { config } from '@vcs-pw/config';
import { step } from '@vcs-pw/test';
import { User } from '@vcs-pw/types/user.type';
import { getHref, getUrl, getPath as getUrlPath, parseLinkNextUrl } from '@vcs-pw/utils/url.util';

// LIFO порядок выполнения
const defaultInterceptors = [applyAllureInterceptor, applyLoggerInterceptor];

type ApiRequestOptions = Omit<
  NonNullable<Parameters<APIRequestContext['fetch']>[1]>,
  'method' | 'ignoreHTTPSErrors'
> & {};

export interface Token {
  value: string;
  type: 'Bearer' | 'token';
}

export interface Auth {
  user?: User;
  token?: Token;
}

export interface AxiosClientOptions {
  baseUrl: string;
  path?: string;
  timeout?: number;
  auth?: Auth;
}

export interface RequestClientOptions {
  client: APIRequestContext;
  baseUrl: string;
  path?: string;
  timeout?: number;
}

export abstract class AxiosWrapper {
  protected readonly client: AxiosInstance;

  constructor({ baseUrl, path, timeout }: AxiosClientOptions) {
    this.client = axios.create({
      baseURL: getHref(baseUrl, path),
      timeout: timeout ?? config.api.timeout,
      validateStatus: (_) => true, // Отключаем валидацию статус кода по умолчанию
    });
    defaultInterceptors.forEach((interceptor) => {
      interceptor(this.client);
    });
  }

  private getPath(config?: AxiosRequestConfig): string {
    const uri = this.client.getUri(config);
    return getUrlPath(uri);
  }

  private request<T = any, R = AxiosResponse<T>, D = any>(
    method: string,
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>,
  ): Promise<R> {
    const appliedConfig = {
      ...config,
      method,
      url,
      data,
    };

    return step(`${method.toUpperCase()} ${this.getPath(appliedConfig)}`, () =>
      this.client.request<T, R>(appliedConfig),
    );
  }

  get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('get', url, config?.data, config);
  }

  delete<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('delete', url, config?.data, config);
  }

  head<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('head', url, config?.data, config);
  }

  options<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('options', url, config?.data, config);
  }

  post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('post', url, data, config);
  }

  put<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('put', url, data, config);
  }

  patch<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R> {
    return this.request<T, R>('patch', url, data, config);
  }

  /**
   * Рекурсивно собирает все элементы со всех страниц пагинации,
   * используя заголовок 'Link' с rel="next", как в Jenkins-плагине.
   *
   * @param url - начальный URL с возможными параметрами
   * @returns Полный список элементов со всех страниц
   */
  async getAllPaginated<T = any>(url: string, limit: number): Promise<T[]> {
    const fetchAll = async (currentUrl: string): Promise<T[]> => {
      const response = await this.get<T[]>(currentUrl, {
        validateStatus: (status) => status >= 200 && status < 300,
      });

      let items: T[] = Array.isArray(response.data) ? response.data : [];

      const nextUrl = parseLinkNextUrl(response);

      if (nextUrl) {
        const nextItems = await fetchAll(nextUrl);
        items.push(...nextItems);
      }

      return items;
    };

    return fetchAll(`${url}?limit=${limit}`);
  }
}

export abstract class RequestWrapper {
  protected readonly client: APIRequestContext;
  protected readonly baseUrl: string;
  protected readonly timeout: number;

  constructor({ client, baseUrl, path, timeout }: RequestClientOptions) {
    this.client = client;
    this.baseUrl = getHref(baseUrl, path);
    this.timeout = timeout ?? config.api.timeout;
  }

  private async request(method: string, url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    const appliedOptions = {
      failOnStatusCode: false, // Отключаем валидацию статус кода по умолчанию
      timeout: this.timeout,
      ...options,
      method,
      ignoreHTTPSErrors: true,
    };

    try {
      const fullUrl = getUrl(this.baseUrl, url);

      logRequest(this.baseUrl, url, appliedOptions);
      const response = await this.client.fetch(fullUrl.href, appliedOptions);
      await logResponse(response);

      return response;
    } catch (error) {
      logError(error);
      throw error;
    }
  }

  get(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('get', url, options);
  }

  delete(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('delete', url, options);
  }

  head(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('head', url, options);
  }

  options(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('options', url, options);
  }

  post(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('post', url, options);
  }

  put(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('put', url, options);
  }

  patch(url: string, options?: ApiRequestOptions): Promise<APIResponse> {
    return this.request('patch', url, options);
  }
}
