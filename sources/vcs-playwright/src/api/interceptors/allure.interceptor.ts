import type { AxiosInstance } from 'axios';
import { ContentType } from 'allure-js-commons';
import { attachment } from '@vcs-pw/test';

import { toPrettyJson } from '@vcs-pw/utils/object.util';
import { isTrue } from '@vcs-pw/utils/env.utils';

const attachOnlyOnFailure = isTrue('ALLURE_ATTACH_ONLY_ON_FAILURE');

const attachToAllure = async (name: string, data: unknown) => {
  await attachment(name, toPrettyJson(data), ContentType.JSON);
};

const formatResponseData = (response: any) => ({
  status: `${response.status} ${response.statusText}`,
  headers: response.headers,
  body: response.data,
});

const formatErrorData = (error: any) => {
  if (error.response) {
    return formatResponseData(error.response);
  }
  return {
    message: error.message,
    stack: error.stack,
  };
};

export const applyAllureInterceptor = (instance: AxiosInstance) => {
  instance.interceptors.request.use(async (request) => {
    if (attachOnlyOnFailure) {
      return request;
    }

    const data = {
      method: request.method,
      baseUrl: request.baseURL,
      url: request.url,
      headers: request.headers,
      auth: request?.auth?.username,
      params: request.params ?? '',
      data: request.data ?? '',
    };
    await attachToAllure('request', data);
    return request;
  });

  instance.interceptors.response.use(
    async (response) => {
      if (attachOnlyOnFailure) {
        return response;
      }

      await attachToAllure('response', formatResponseData(response));
      return response;
    },
    async (error) => {
      const data = formatErrorData(error);
      const name = error.response ? 'response' : 'error';
      await attachToAllure(name, data);
      return Promise.reject(error);
    },
  );
};
