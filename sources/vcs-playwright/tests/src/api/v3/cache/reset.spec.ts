import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { DataGenerator } from '@vcs-pw/services/data.service';

const toPath = (tenant: string) => `/api/v3/cache/${tenant}/reset`;

test.describe(
  'GET /api/v3/cache/:tenant/reset',
  {
    tag: [Layer.API, '@v3', '@reset-cache'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v3/cache/:tenant/reset — 200 OK — Сброс кеша ролевой модели для тенанта',
      {
        tag: ['@VCS-15077', Priority.CRITICAL],
      },
      async ({ tenantInfo, admin, apiRegistry }) => {
        const path = toPath(tenantInfo.id);
        const apiClient = apiRegistry.client.withBasic(admin);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: '',
        });
      },
    );

    test(
      'GET /api/v3/cache/:tenant/reset — 403 Forbidden — Вызов доступен только администратору',
      {
        tag: ['@VCS-15078', Priority.NORMAL],
      },
      async ({ tenantInfo, user, apiRegistry }) => {
        const path = toPath(tenantInfo.id);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Ошибка доступа',
          detail: 'У Вас нет прав доступа к этому ресурсу',
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/cache/:tenant/reset — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа admin:privileges',
      {
        tag: ['@VCS-15079', Priority.NORMAL],
      },
      async ({ tenantInfo, admin, apiRegistry, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(admin.name, []);

        const path = toPath(tenantInfo.id);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: admin:privileges');
      },
    );

    test(
      'GET /api/v3/cache/:tenant/reset — 200 OK — Выполнение запроса с токеном со скоупом admin:privileges',
      {
        tag: ['@VCS-15080', Priority.NORMAL],
      },
      async ({ tenantInfo, admin, apiRegistry, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(admin.name, ['admin:privileges']);

        const path = toPath(tenantInfo.id);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
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
        `GET /api/v3/cache/:tenant/reset — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-15081', Priority.CRITICAL],
        },
        async ({ tenantInfo, apiRegistry, dataGenerator }) => {
          const path = toPath(tenantInfo.id);

          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'GET /api/v3/cache/:tenant/reset — 404 Not Found — Передан идентификатор несуществующего тенанта',
      {
        tag: ['@VCS-15082', Priority.NORMAL],
      },
      async ({ admin, apiRegistry, dataGenerator }) => {
        const fakeUuid = dataGenerator.uuid();

        const path = toPath(fakeUuid);
        const apiClient = apiRegistry.client.withBasic(admin);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.notFound(response, {
          detail: 'Тенант с таким UUID не найден',
          instance: path,
        });
      },
    );
  },
);
