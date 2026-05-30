import { AxiosInstance } from 'axios';

import { APIRequestContext, APIResponse } from '@playwright/test';
import { log } from '@vcs-pw/logger';
import { tryToGetJson } from '@vcs-pw/utils/api.util';

const formatResponseData = (response: any) => ({
  status: `${response.status} ${response.statusText}`,
  headers: response.headers,
  body: response.data ?? '',
});

const formatErrorData = (error: any) => {
  if (error.response) {
    return formatResponseData(error.response);
  }
  return formatError(error);
};

const formatError = (error: any) => {
  return {
    message: error.message,
    stack: error.stack,
  };
};

export const applyLoggerInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use((request) => {
    const data = {
      method: request.method,
      baseUrl: request.baseURL,
      path: request.url,
      headers: request.headers,
      auth: request.auth?.username,
      params: request.params ?? '',
      data: request.data ?? '',
    };
    log.info('Отправка запроса', { request: data });
    return request;
  });

  instance.interceptors.response.use(
    (response) => {
      const data = formatResponseData(response);
      log.info('Результат вызова', { response: data });
      return response;
    },
    (error) => {
      const data = formatErrorData(error);
      log.error('Запрос завершился ошибкой', { error: data });
      return Promise.reject(error);
    },
  );
};

export function logRequest(baseUrl: string, path: string, options: Parameters<APIRequestContext['fetch']>[1]) {
  const request = {
    method: options?.method,
    baseUrl,
    path,
    headers: options?.headers ?? '',
    params: options?.params ?? '',
    data: options?.data ?? options?.form ?? options?.multipart ?? '',
  };

  log.info('Отправка запроса', { request });
}

export async function logResponse(response: APIResponse) {
  const content = await tryToGetJson(response);
  const data = {
    status: `${response.status()} ${response.statusText()}`,
    headers: response.headers(),
    body: content,
  };

  log.info('Результат вызова', { response: data });
}

export function logError(error: Error) {
  const data = formatError(error);
  log.error('Запрос завершился ошибкой', { error: data });
}
