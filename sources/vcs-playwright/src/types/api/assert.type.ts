import { AxiosResponse } from 'axios';
import z from 'zod';

import { HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { expect, expectNoSoftFailure } from '@vcs-pw/test/ext';

import { zProblemDetail } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { zErrorResponse } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { getResponseContent, getResponseData, HttpResponse } from '@vcs-pw/utils/api.util';

export const NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG = expect.stringContaining(
  'Недостаточно прав для взаимодействия с данным репозиторием',
);
export const NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG = expect.stringContaining(
  'Недостаточно прав для взаимодействия с данным проектом',
);

const CHECK_STEP_NAME = 'API: Ответ корректен';

export type AsymmetricMatcher = Record<string, any>;
type StringCheck = string | AsymmetricMatcher;

export interface ValidationError {
  location: string;
  name: string;
  error: StringCheck;
  code: string;
}

export interface WebValidationError {
  error: StringCheck;
  field: string;
}

export interface WebApiError {
  title: StringCheck;
  detail: StringCheck;
  validation?: WebValidationError[] | AsymmetricMatcher;
}

export interface ProblemDetail {
  status: number;
  title: StringCheck;
  detail: StringCheck;
  instance: StringCheck;
  validation?: ValidationError[] | AsymmetricMatcher;
}

export interface ApiError {
  status: number;
  message?: StringCheck;
  errors?: AsymmetricMatcher | StringCheck[];
}

export interface PlainResponse {
  status: number;
  message: StringCheck;
}

export interface SuccessfulResponse {
  status: number;
  jsonSchemaFile: string;
  zodSchema: z.ZodType<any>;
  data: object | string;
  xRequestIdHeader: boolean;
}

export async function assertPlainResponse(response: AxiosResponse, options: PlainResponse) {
  await step(CHECK_STEP_NAME, async () => {
    expect.soft(response).toHaveStatusCode(options.status);
    expect.soft(response.data).toEqual(options.message);
    expectNoSoftFailure();
  });
}

export async function assertApiError(response: AxiosResponse, options: Partial<ApiError>) {
  await step(CHECK_STEP_NAME, async () => {
    const { status, ...fields } = options;
    expect.soft(response).toHaveStatusCode(status);
    expect.soft(response).toHaveJsonContentType();
    expect.soft(response).toHaveXRequestIdHeader();
    expect.soft(response.data).toMatchObject({ url: expect.any(String), ...fields });
    await expect.soft(response).toMatchJsonSchemaFile('api-error.schema.json');
    expectNoSoftFailure();
  });
}

export async function assertWebApiErrorResponse(
  response: HttpResponse,
  status: number,
  expected: Partial<WebApiError>,
) {
  await step(CHECK_STEP_NAME, async () => {
    const data = await getResponseData(response);
    expect.soft(response).toHaveStatusCode(status);
    expect.soft(response).toHaveJsonContentType();
    expect.soft(data).toMatchObject(expected);
    await expect.soft(response).toMatchZodSchema(zErrorResponse);
    expectNoSoftFailure();
  });
}

export async function assertProblemDetailResponse(response: AxiosResponse, expected: Partial<ProblemDetail>) {
  await step(CHECK_STEP_NAME, async () => {
    expect.soft(response).toHaveStatusCode(expected.status);
    expect.soft(response).toHaveProblemJsonContentType();
    expect.soft(response).toHaveXRequestIdHeader();
    expect.soft(response.data).toMatchObject(expected);
    await expect.soft(response).toMatchZodSchema(zProblemDetail);
    expectNoSoftFailure();
  });
}

async function assertSuccessfulResponse(response: HttpResponse, expected: Partial<SuccessfulResponse>) {
  await step(CHECK_STEP_NAME, async () => {
    expect.soft(response).toHaveStatusCode(expected.status);

    if (!!expected.xRequestIdHeader) {
      expect.soft(response).toHaveXRequestIdHeader();
    }

    if (!!expected.jsonSchemaFile) {
      await expect.soft(response).toMatchJsonSchemaFile(expected.jsonSchemaFile);
    }

    if (!!expected.zodSchema) {
      await expect.soft(response).toMatchZodSchema(expected.zodSchema);
    }

    if (expected.data !== undefined) {
      if (typeof expected.data === 'string') {
        const content = await getResponseContent(response);
        expect.soft(content).toEqual(expected.data);

        if (!!expected.data) {
          expect.soft(response).toHavePlainContentType();
        }
      } else {
        const data = await getResponseData(response);
        expect.soft(data).toEqual(expected.data);
        expect.soft(response).toHaveJsonContentType();
      }
    }
    expectNoSoftFailure();
  });
}

export const HttpResponseAssertions = {
  ok: (response: HttpResponse, expected?: Omit<Partial<SuccessfulResponse>, 'status'>) =>
    assertSuccessfulResponse(response, {
      status: HttpStatusCode.Ok,
      xRequestIdHeader: true,
      ...expected,
    }),

  multiStatus: (response: HttpResponse, expected?: Omit<Partial<SuccessfulResponse>, 'status'>) =>
    assertSuccessfulResponse(response, {
      status: HttpStatusCode.MultiStatus,
      xRequestIdHeader: true,
      ...expected,
    }),

  created: (response: HttpResponse, expected?: Omit<Partial<SuccessfulResponse>, 'status'>) =>
    assertSuccessfulResponse(response, {
      status: HttpStatusCode.Created,
      xRequestIdHeader: true,
      ...expected,
    }),

  noContent: (response: HttpResponse, expected?: Omit<Partial<SuccessfulResponse>, 'status'>) =>
    assertSuccessfulResponse(response, {
      status: HttpStatusCode.NoContent,
      xRequestIdHeader: true,
      ...expected,
    }),

  // --- API v3 ---
  badRequest: (response: AxiosResponse, expected?: Omit<Partial<ProblemDetail>, 'status'>) =>
    assertProblemDetailResponse(response, {
      status: HttpStatusCode.BadRequest,
      title: expect.stringMatching(/Ошибка (валидации|данных)|Некорректный запрос/gi),
      detail: expect.stringContaining('Обнаружены ошибки в данных запроса'),
      ...expected,
    }),

  unauthorized: (response: AxiosResponse, expected?: Omit<Partial<ProblemDetail>, 'status'>) =>
    assertProblemDetailResponse(response, {
      status: HttpStatusCode.Unauthorized,
      title: 'Ошибка токена',
      detail: 'Проверьте токен доступа',
      ...expected,
    }),

  forbidden: (response: AxiosResponse, expected?: Omit<Partial<ProblemDetail>, 'status'>) =>
    assertProblemDetailResponse(response, {
      status: HttpStatusCode.Forbidden,
      title: 'Доступ запрещён',
      ...expected,
    }),

  notFound: (response: AxiosResponse, expected?: Omit<Partial<ProblemDetail>, 'status'>) =>
    assertProblemDetailResponse(response, {
      status: HttpStatusCode.NotFound,
      title: expect.stringContaining('Ошибка поиска'),
      ...expected,
    }),

  conflict: (response: AxiosResponse, expected?: Omit<Partial<ProblemDetail>, 'status'>) =>
    assertProblemDetailResponse(response, {
      status: HttpStatusCode.Conflict,
      title: 'Конфликт',
      ...expected,
    }),

  // --- API v2 ---
  badRequestV2: async (response: AxiosResponse, message?: StringCheck, errors?: AsymmetricMatcher | StringCheck[]) => {
    const checks: ApiError = { status: HttpStatusCode.BadRequest };
    if (message) {
      checks.message = message;
    }
    if (errors) {
      checks.errors = errors;
    }
    await assertApiError(response, checks);
  },

  unauthorizedV2: (response: AxiosResponse) =>
    assertApiError(response, {
      status: HttpStatusCode.Unauthorized,
      message: expect.stringContaining('need authorization'),
    }),

  forbiddenV2: (response: AxiosResponse, message: StringCheck) =>
    assertApiError(response, {
      status: HttpStatusCode.Forbidden,
      message,
    }),

  notFoundV2: (response: AxiosResponse, message: StringCheck) =>
    assertApiError(response, {
      status: HttpStatusCode.NotFound,
      message,
    }),

  // --- Web v2 ---

  badRequestWeb: (response: HttpResponse, expected?: Partial<WebApiError>) =>
    assertWebApiErrorResponse(response, HttpStatusCode.BadRequest, {
      title: expect.stringMatching(/Ошибка (валидации|данных)/g),
      detail: expect.stringContaining('Обнаружены ошибки в данных запроса'),
      ...expected,
    }),

  unauthorizedWeb: (response: HttpResponse, expected?: Partial<WebApiError>) =>
    assertWebApiErrorResponse(response, HttpStatusCode.Unauthorized, {
      title: 'Требуется аутентификация',
      detail: expect.stringContaining('Отсутствует или истек срок действия JWT-токена. Авторизуйтесь снова'),
      ...expected,
    }),

  forbiddenWeb: (response: HttpResponse, expected?: Partial<WebApiError>) =>
    assertWebApiErrorResponse(response, HttpStatusCode.Forbidden, {
      title: expect.stringMatching(/Доступ запрещен|Forbidden/g),
      detail: expect.stringMatching(/Вам закрыт доступ|Ресурс недоступен/g),
      ...expected,
    }),

  notFoundWeb: (response: HttpResponse, expected?: Partial<WebApiError>) =>
    assertWebApiErrorResponse(response, HttpStatusCode.NotFound, {
      title: 'Ошибка поиска',
      ...expected,
    }),

  conflictWeb: (response: HttpResponse, expected?: Partial<WebApiError>) =>
    assertWebApiErrorResponse(response, HttpStatusCode.Conflict, {
      title: 'Конфликт',
      ...expected,
    }),

  // --- Plain ---
  notFoundPlain: (response: AxiosResponse) =>
    assertPlainResponse(response, {
      status: HttpStatusCode.NotFound,
      message: expect.stringContaining('not found'),
    }),
} as const;
