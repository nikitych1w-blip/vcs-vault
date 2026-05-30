import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { V2GetProjectKeyDataZodType, zSchemasProjectKey } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { DataGenerator } from '@vcs-pw/services/data.service';

const PATH = '/api/v2/projects/projectkey';

type QueryParams = V2GetProjectKeyDataZodType['query'];

test.describe(
  'GET /api/v2/projects/projectkey',
  {
    tag: [Layer.API, '@v2', '@get-project-key'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v2/projects/projectkey — 200 OK — Получение ключа проекта',
      {
        tag: ['@VCS-10944', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const query = { tenant_key: tenantInfo.tenant_key, project_name: projectInfo.name };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zSchemasProjectKey,
          data: {
            project_key: projectInfo.project_key,
          },
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
        `GET /api/v2/projects/projectkey — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-10947', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeQuery = {
            tenant_key: dataGenerator.faker.lorem.word(),
            project_key: dataGenerator.faker.lorem.word(),
            repository_name: dataGenerator.faker.lorem.word(),
          };

          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.get(PATH, {
            headers: { ...generateAuthHeader(dataGenerator) },
            params: fakeQuery,
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'GET /api/v2/projects/projectkey — 403 Forbidden — Отсутствует привилегия read на проект',
      {
        tag: ['@VCS-10948', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager }) => {
        const projectInfo = await entityManager.createPrivateProjectV2(tenantInfo.tenant_key);

        const query = { tenant_key: tenantInfo.tenant_key, project_name: projectInfo.name };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.forbiddenV2(response, 'Access prohibited');
      },
    );

    test(
      'GET /api/v2/projects/projectkey — 200 OK — Успешный вызов с помощью токена со скоупом read:project',
      {
        tag: ['@VCS-10945', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const token = await entityManager.createAccessTokenV1(user.name, ['read:project']);

        const query = { tenant_key: tenantInfo.tenant_key, project_name: projectInfo.name };
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zSchemasProjectKey,
          data: {
            project_key: projectInfo.project_key,
          },
        });
      },
    );

    test(
      'GET /api/v2/projects/projectkey — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа read:project',
      {
        tag: ['@VCS-11014', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const query = { tenant_key: tenantInfo.tenant_key, project_name: projectInfo.name };
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: read:project');
      },
    );

    [
      {
        title: 'Передан ключ несуществующего тенанта',
        generateQueryParams: (projectOptions: QueryParams, dg: DataGenerator) => {
          return {
            tenant_key: dg.uuid(),
            project_name: projectOptions.project_name,
          };
        },
        message: 'Err: tenant not exists',
      },
      {
        title: 'Передано имя несуществующего проекта',
        generateQueryParams: (projectOptions: QueryParams, dg: DataGenerator) => {
          return {
            tenant_key: projectOptions.tenant_key,
            project_name: dg.faker.string.ulid(),
          };
        },
        message: 'Err: project not exists',
      },
    ].forEach(({ title, generateQueryParams, message }) => {
      test(
        `GET /api/v2/projects/projectkey — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-10946', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenant_key: tenantInfo.id, project_name: projectInfo.name };

          const requestParams = generateQueryParams(projectOptions, dataGenerator);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(PATH, { params: requestParams });

          await HttpResponseAssertions.notFoundV2(response, message);
        },
      );
    });

    [
      {
        title: 'Передан пустой ключ тенанта',
        generateQueryParams: (projectOptions: QueryParams) => {
          return {
            tenant_key: '',
            project_name: projectOptions.project_name,
          };
        },
        message: undefined,
        errors: expect.arrayContaining([expect.stringContaining('tenant_key is required')]),
      },
      {
        title: 'Передан пустое имя проекта',
        generateQueryParams: (projectOptions: QueryParams) => {
          return {
            tenant_key: projectOptions.tenant_key,
            project_name: '',
          };
        },
        message: 'Err: project name is required',
        errors: undefined,
      },
    ].forEach(({ title, generateQueryParams, message, errors }) => {
      test(
        `GET /api/v2/projects/projectkey — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-11015', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenant_key: tenantInfo.id, project_name: projectInfo.name };

          const requestParams = generateQueryParams(projectOptions);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(PATH, { params: requestParams });

          await HttpResponseAssertions.badRequestV2(response, message, errors);
        },
      );
    });
  },
);
