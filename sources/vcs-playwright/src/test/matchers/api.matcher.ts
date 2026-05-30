import { ExpectMatcherState, MatcherReturnType } from '@playwright/test';
import { ContentType as AllureContentType } from 'allure-js-commons';
import { z } from 'zod';

import { schemaValidator } from '@vcs-pw/services/api.service';
import { attachment } from '@vcs-pw/test';
import { validate as zodValidate } from '@vcs-pw/types';
import { ContentType, Header } from '@vcs-pw/types/api/header.type';
import { HttpResponse, getResponseData, getResponseHeaders, getResponseStatus } from '@vcs-pw/utils/api.util';
import { getSchema } from '@vcs-pw/utils/file.util';
import { toPrettyJson } from '@vcs-pw/utils/object.util';

// const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface LinkHeaderValue {
  next?: string | RegExp;
  last?: string | RegExp;
  first?: string | RegExp;
  prev?: string | RegExp;
}

export interface ApiMatchers<R> extends Record<string, (this: ExpectMatcherState, ...args: any[]) => R | Promise<R>> {
  toHaveStatusCode(response: HttpResponse, expectedStatus: number | undefined): R;

  toHaveHeader(response: HttpResponse, name: string, value?: string | RegExp): R;
  toHaveLocationHeader(response: HttpResponse, value?: string | RegExp): R;
  toHaveLinkHeader(response: HttpResponse, value: LinkHeaderValue): R;
  toHaveXTotalCountHeader(response: HttpResponse, value: number): R;
  toHaveXRequestIdHeader(response: HttpResponse): R;
  toHavePlainContentType(response: HttpResponse): R;
  toHaveJsonContentType(response: HttpResponse): R;
  toHaveProblemJsonContentType(response: HttpResponse): R;

  toMatchZodSchema<T>(response: HttpResponse, schema: z.ZodType<T>): Promise<R>;
  toMatchZodSchema<T>(object: Record<string, any>, schema: z.ZodType<T>): Promise<R>;
  toMatchJsonSchema(response: HttpResponse, schema: Record<string, any>): Promise<R>;
  toMatchJsonSchema(object: Record<string, any>, schema: Record<string, any>): Promise<R>;
  toMatchJsonSchemaFile(response: HttpResponse, schemaFile: string): Promise<R>;
}

export const apiMatcher: ApiMatchers<MatcherReturnType> = {
  toHaveStatusCode(response: HttpResponse, expectedStatus: number | undefined) {
    const assertionName = 'toHaveStatusCode';

    const actualStatus = getResponseStatus(response);
    const pass = actualStatus === expectedStatus;

    return {
      pass,
      message: () =>
        pass
          ? `Ожидался статус-код ${expectedStatus}, получен ${actualStatus}`
          : `Ожидался статус-код ${expectedStatus}, но получен ${actualStatus}`,
      actual: actualStatus,
      expected: expectedStatus,
      name: assertionName,
    };
  },

  toHaveHeader(response: HttpResponse, name: string, value?: string | RegExp) {
    const assertionName = 'toHaveHeader';
    const headerName = name.toLowerCase();

    const headers = getResponseHeaders(response);
    const headerValue = headers[headerName];
    const hasHeader = !!headerValue;

    // Если значение не указано, проверяем только наличие заголовка
    if (value === undefined) {
      const pass = hasHeader;
      return {
        pass,
        message: () =>
          pass ? `Заголовок "${headerName}" присутствует` : `Ожидался заголовок "${headerName}", но он отсутствует`,
        name: assertionName,
      };
    }

    // Если заголовка нет, но ожидается значение
    if (!hasHeader) {
      const expectedDesc =
        value instanceof RegExp ? `, соответствующий шаблону ${value.toString()}` : ` со значением "${value}"`;

      return {
        pass: false,
        message: () => `Ожидался заголовок "${headerName}"${expectedDesc}, но он отсутствует`,
        name: assertionName,
      };
    }

    // Проверка значения заголовка
    let pass: boolean;
    let expectation: string;

    if (value instanceof RegExp) {
      pass = value.test(headerValue);
      expectation = `заголовок "${headerName}", соответствующий шаблону ${value.toString()}`;
    } else {
      pass = headerValue === value;
      expectation = `заголовок "${headerName}" со значением "${value}"`;
    }

    return {
      pass,
      message: () =>
        pass ? `Ожидался и найден ${expectation}` : `Ожидался ${expectation}, но получено "${headerValue}"`,
      name: assertionName,
    };
  },

  toHaveLocationHeader(response: HttpResponse, value?: string | RegExp) {
    return apiMatcher.toHaveHeader(response, Header.LOCATION, value);
  },

  toHaveLinkHeader(response: HttpResponse, value: LinkHeaderValue) {
    const expected = Object.entries(value)
      .map(([rel, url]) => `<${url}>; rel="${rel}"`)
      .join(',');
    return apiMatcher.toHaveHeader(response, Header.LINK, expected);
  },

  toHaveXTotalCountHeader(response: HttpResponse, value: number) {
    return apiMatcher.toHaveHeader(response, Header.X_TOTAL_COUNT, String(value));
  },

  toHaveXRequestIdHeader(response: HttpResponse) {
    // После исправления дефекта вернуть проверку на шаблон ID
    return apiMatcher.toHaveHeader(response, Header.X_REQUEST_ID);
  },

  toHavePlainContentType(response: HttpResponse) {
    return apiMatcher.toHaveHeader(response, Header.CONTENT_TYPE, ContentType.TEXT_PLAIN);
  },

  toHaveJsonContentType(response: HttpResponse) {
    return apiMatcher.toHaveHeader(response, Header.CONTENT_TYPE, ContentType.APPLICATION_JSON);
  },

  toHaveProblemJsonContentType(response: HttpResponse) {
    return apiMatcher.toHaveHeader(response, Header.CONTENT_TYPE, ContentType.APPLICATION_PROBLEM_JSON);
  },

  async toMatchZodSchema<T>(response: HttpResponse | Record<string, any>, schema: z.ZodType<T>) {
    const assertionName = 'toMatchZodSchema';

    const data = await getResponseData(response);
    const result = zodValidate(schema, data, false);

    if (result.success) {
      return {
        message: () => 'Ответ соответствует схеме',
        pass: true,
      };
    }

    await attachment('body', typeof data === 'string' ? data : toPrettyJson(data), AllureContentType.TEXT);

    const errors = result.error.issues.map((issue) => `-> ${issue.path.join('.')}: ${issue.message}`).join('\n');

    return {
      message: () => `Ошибки валидации схемы:\n${errors}`,
      pass: false,
      actual: data,
      expected: schema,
      name: assertionName,
    };
  },

  async toMatchJsonSchema(response: HttpResponse | Record<string, any>, schema: Record<string, any>) {
    const assertionName = 'toMatchJsonSchema';

    const data = await getResponseData(response);
    const result = schemaValidator.validate(schema, data);

    if (result.valid) {
      return {
        message: () => 'Ответ соответствует схеме',
        pass: true,
      };
    }

    await attachment('body', typeof data === 'string' ? data : toPrettyJson(data), AllureContentType.TEXT);

    const errors = result.errors
      .map((error) => `-> ${error.instancePath ? error.instancePath + ': ' : ''}${error.message}`)
      .join('\n');

    return {
      message: () => `Ошибки валидации схемы:\n${errors}`,
      pass: false,
      actual: data,
      expected: schema,
      name: assertionName,
    };
  },

  async toMatchJsonSchemaFile(response: HttpResponse, schemaFile: string) {
    const schema = await getSchema(schemaFile);
    return apiMatcher.toMatchJsonSchema(response, schema);
  },
};
