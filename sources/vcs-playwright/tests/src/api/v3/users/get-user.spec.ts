import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { zUserInfo } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { DataGenerator } from '@vcs-pw/services/data.service';

const toPath = (username: string) => `/api/v3/users/${username}`;

test.describe(
  'GET /api/v3/users/:username',
  {
    tag: [Layer.API, '@v3', '@get-user'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v3/users/:username — 200 OK — Получение информации о пользователе',
      {
        tag: ['@VCS-9731', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, config }) => {
        const apiClient = apiRegistry.client.withBasic(userPool.get());

        const target = userPool.get();
        const path = toPath(target.name);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zUserInfo,
          data: {
            login: target.name,
            full_name: target.fullName,
            email: target.email,
            avatar_url: expect.stringMatching(new RegExp(`^${config.ui.baseUrl}avatars/[a-z0-9]+$`)),
          },
        });
      },
    );

    test(
      'GET /api/v3/users/:username — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа user',
      {
        tag: ['@VCS-12549', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(user.name, []);

        const apiClient = apiRegistry.client.withToken(token);
        const path = toPath(user.name);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: user');
      },
    );

    test(
      'GET /api/v3/users/:username — 200 OK — Выполнение запроса с токеном со скоупом user',
      {
        tag: ['@VCS-12919', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(user.name, ['user']);

        const apiClient = apiRegistry.client.withToken(token);
        const path = toPath(user.name);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zUserInfo,
          data: expect.objectContaining({
            login: user.name,
          }),
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
        `GET /api/v3/users/:username — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9734', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const path = toPath(dataGenerator.faker.internet.username());

          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'GET /api/v3/users/:username — 404 Not Found — Передан несуществующий логин пользователя',
      {
        tag: ['@VCS-12557', Priority.NORMAL],
      },
      async ({ user, apiRegistry, dataGenerator }) => {
        const fakeUsername = dataGenerator.faker.internet.username();

        const apiClient = apiRegistry.client.withBasic(user);
        const path = toPath(fakeUsername);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.notFound(response, {
          detail: `Пользователь с таким логином ${fakeUsername} не найден`,
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/users/:username — 404 Not Found — Передана пустая строка',
      {
        tag: ['@VCS-12558', Priority.MINOR],
      },
      async ({ user, apiRegistry }) => {
        const apiClient = apiRegistry.client.withBasic(user);
        const path = toPath('');
        const response = await apiClient.get(path);

        await HttpResponseAssertions.notFoundPlain(response);
      },
    );
  },
);
