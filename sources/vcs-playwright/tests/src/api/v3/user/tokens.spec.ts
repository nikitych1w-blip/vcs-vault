import { zUserTokenCreated } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { CYRILLIC_CHARS, DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { getRandomElement } from '@vcs-pw/utils/object.util';

const PATH = '/api/v3/user/tokens';

const PERMITTED_SCOPES = [
  'repo',
  'admin:repo_hook',
  'write:repo_hook',
  'read:repo_hook',
  'public_repo',
  'repo:status',
  'user',
  'read:user',
  'user:email',
  'notification',
  'project',
  'read:project',
  'write:project',
  'codehub',
] as const;

const FORBIDDEN_SCOPES = [
  'all',
  'delete_repo',
  'admin:org',
  'admin:user_hook',
  'admin:application',
  'admin:privileges',
  'sudo',
  'tenant',
  'write:tenant',
  'read:tenant',
] as const;

const toValidBody = (dg: DataGenerator) => {
  return {
    name: dg.faker.string.alphanumeric({ length: { min: 1, max: 100 } }),
    scopes: [getRandomElement(PERMITTED_SCOPES)],
  };
};

test.describe(
  'POST /api/v3/user/tokens',
  {
    tag: [Layer.API, '@v3', '@create-user-token'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    [
      {
        title: 'Имя содержит 1 символ, указаны все допустимые скоупы',
        generateBody: (dg: DataGenerator) => {
          return {
            name: dg.faker.string.alphanumeric(),
            scopes: [...PERMITTED_SCOPES],
          };
        },
      },
      {
        title: 'Имя содержит 100 символов. Указан 1 скоуп',
        generateBody: (dg: DataGenerator) => {
          return {
            name: dg.faker.string.fromCharacters(CYRILLIC_CHARS, 100),
            scopes: [getRandomElement(PERMITTED_SCOPES)],
          };
        },
      },
    ].forEach(({ title, generateBody }) => {
      test(
        `POST /api/v3/user/tokens — 201 Created — Создание токена пользователя. ${title}`,
        {
          tag: ['@VCS-9920', Priority.CRITICAL],
        },
        async ({ user, apiRegistry, dataGenerator, entityManager }) => {
          const apiClient = apiRegistry.client.withBasic(user);

          const body = generateBody(dataGenerator);
          const response = await apiClient.post(PATH, body);

          entityManager.addDeleteTokenHook(user.name, body.name);

          const token = response.data.sha1;
          await HttpResponseAssertions.created(response, {
            zodSchema: zUserTokenCreated,
            data: {
              id: expect.any(Number),
              name: body.name,
              scopes: expect.arrayEqualsInAnyOrder(body.scopes),
              sha1: expect.hasLength(40),
              token_last_eight: token?.slice(-8),
              created_at: expect.stringIso(),
            },
          });

          await step('Успешная аутентификация полученным токеном', async () => {
            const usersApi = apiRegistry.v1.user.withToken(token);
            const userInfo = await usersApi.getAuthenticatedUser();
            expect(userInfo.username).toBe(user.name);
          });
        },
      );
    });

    test(
      'POST /api/v3/user/tokens — 201 Created — Выполнение запроса с токеном без скоупов',
      {
        tag: ['@VCS-12561', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, dataGenerator }) => {
        const token = await entityManager.createAccessTokenV1(user.name, []);

        const body = toValidBody(dataGenerator);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(PATH, body);

        entityManager.addDeleteTokenHook(user.name, body.name);

        await HttpResponseAssertions.created(response, {
          zodSchema: zUserTokenCreated,
        });
      },
    );

    [
      {
        title: 'Заголовок Authorization отсутствует',
        generateAuthHeader: (_: DataGenerator) => {
          return {};
        },
      },
      {
        title: 'Заголовок Authorization имеет пустое значение',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: '' };
        },
      },
      {
        title: 'Заголовок Authorization имеет невалидный token',
        generateAuthHeader: (dg: DataGenerator) => {
          return { Authorization: `token ${dg.faker.string.alphanumeric(40)}` };
        },
      },
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `POST /api/v3/user/tokens — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9921', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.post(PATH, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'POST /api/v3/user/tokens — 409 Conflict — Имя токена должно быть уникальным в разрезе пользователя',
      {
        tag: ['@VCS-12562', Priority.NORMAL],
      },
      async ({ userPool, apiRegistry, dataGenerator, entityManager }) => {
        const body = toValidBody(dataGenerator);

        const firstUser = userPool.get();
        const firstUserApiClient = apiRegistry.client.withBasic(firstUser);
        const response = await firstUserApiClient.post(PATH, body);
        entityManager.addDeleteTokenHook(firstUser.name, body.name);

        await HttpResponseAssertions.created(response);

        const duplicateResponse = await firstUserApiClient.post(PATH, body);

        await HttpResponseAssertions.conflict(duplicateResponse, {
          detail: expect.stringMatching(/Токен с именем .* уже существует у пользователя/),
          instance: PATH,
        });

        const secondUser = userPool.get();
        const secondUserApiClient = apiRegistry.client.withBasic(secondUser);
        const secondResponse = await secondUserApiClient.post(PATH, body);

        await HttpResponseAssertions.created(secondResponse);
      },
    );

    [
      {
        title: 'Имя токена равно пустой строке',
        generateBody: (dg: DataGenerator) => {
          const validBody = toValidBody(dg);
          return { ...validBody, name: '' };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'name',
            error: 'Имя токена обязательно для заполнения',
            code: 'token_name_required',
          },
        ],
      },

      {
        title: 'Имя токена содержит 101 символ',
        generateBody: (dg: DataGenerator) => {
          const validBody = toValidBody(dg);
          return { ...validBody, name: dg.faker.string.fromCharacters(CYRILLIC_CHARS, 101) };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'name',
            error: expect.stringContaining('Имя токена должно содержать от 1 до 100 символов'),
            code: 'invalid_token_name_length',
          },
        ],
      },
      {
        title: 'Передано 0 скоупов',
        generateBody: (dg: DataGenerator) => {
          const validBody = toValidBody(dg);
          return { ...validBody, scopes: [] };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'scopes',
            error: 'Список прав доступа не может быть пустым',
            code: 'scopes_required',
          },
        ],
      },
      {
        title: 'Дублирование скоупов',
        generateBody: (dg: DataGenerator) => {
          const validBody = toValidBody(dg);
          return { ...validBody, scopes: [...validBody.scopes, ...validBody.scopes] };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'scopes[1]',
            error: expect.stringMatching(/Право доступа '.*' дублируется/),
            code: 'duplicate_scope',
          },
        ],
      },
      {
        title: 'Передан несуществующий скоуп',
        generateBody: (dg: DataGenerator) => {
          const validBody = toValidBody(dg);
          return { ...validBody, scopes: [dg.faker.lorem.word()] };
        },
        validationErrors: expect.arrayContaining([
          {
            location: 'field',
            name: 'scopes',
            error: expect.stringContaining('Неверный формат scopes: invalid access token scope'),
            code: 'invalid_scope',
          },
        ]),
      },
      ...FORBIDDEN_SCOPES.map((scope) => {
        return {
          title: `Указан запрещенный скоуп '${scope}'`,
          generateBody: (dg: DataGenerator) => {
            const validBody = toValidBody(dg);
            return { ...validBody, scopes: [scope] };
          },
          validationErrors: [
            {
              location: 'field',
              name: 'scopes[0]',
              error: expect.stringMatching(new RegExp(`Scope '${scope}' не поддерживается`)),
              code: 'unsupported_scope',
            },
          ],
        };
      }),
    ].forEach(({ title, generateBody, validationErrors }) => {
      test(
        `POST /api/v3/user/tokens — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-12563', Priority.NORMAL],
        },
        async ({ user, apiRegistry, dataGenerator }) => {
          const body = generateBody(dataGenerator);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(PATH, body);

          await HttpResponseAssertions.badRequest(response, { validation: validationErrors, instance: PATH });
        },
      );
    });
  },
);
