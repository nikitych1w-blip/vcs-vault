import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { V2GetRepoKeyDataZodType, zSchemasRepoKey } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { DataGenerator } from '@vcs-pw/services/data.service';

const PATH = '/api/v2/projects/repos/repokey';

type QueryParams = V2GetRepoKeyDataZodType['query'];

test.describe(
  'GET /api/v2/projects/repos/repokey',
  {
    tag: [Layer.API, '@v2', '@get-repo-key'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v2/projects/repos/repokey — 200 OK — Получение ключа репозитория',
      {
        tag: ['@VCS-10949', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);
        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const query = { ...projectOptions, repository_name: repoInfo.name };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zSchemasRepoKey,
          data: {
            repo_key: repoInfo.repository_key,
          },
        });
      },
    );

    test(
      'GET /api/v2/projects/repos/repokey — 404 Not Found — Ключ репозитория отсутствует',
      {
        tag: ['@VCS-12517', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoRequest = await dataGenerator.createRepoV3Request();
        // При создании через API v1 не генерируется ключ
        const orgsReposApi = apiRegistry.v1.orgs.repos.withBasic(user);
        const repoInfo = await orgsReposApi.createRepo(projectInfo.name, repoRequest);

        const query = {
          tenant_key: tenantInfo.tenant_key,
          project_key: projectInfo.project_key,
          repository_name: repoInfo.name,
        };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.notFoundV2(response, expect.stringContaining('Repository key not found'));
      },
    );

    test(
      'GET /api/v2/projects/repos/repokey — 200 OK — Генерируется ключ для репозитория, созданного через API v3',
      {
        tag: ['@VCS-13236', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV3({ tenantId: tenantInfo.id, projectName: projectInfo.name });
        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const query = { ...projectOptions, repository_name: repoInfo.name };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zSchemasRepoKey,
          data: {
            repo_key: expect.stringContaining(repoInfo.name),
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
        title: 'Заголовок Authorization имеет несуществующий BasicAuth',
        generateAuthHeader: (dg: DataGenerator) => {
          return { Authorization: 'Basic ' + btoa(`${dg.faker.internet.username()}:${dg.faker.internet.password()}`) };
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
        `GET /api/v2/projects/repos/repokey — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-10952', Priority.CRITICAL],
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
      'GET /api/v2/projects/repos/repokey — 403 Forbidden — Отсутствует привилегия read на репозиторий',
      {
        tag: ['@VCS-12522', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions, { private: true });

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        await privilegeService.assertRepoPrivilege(repoOptions, user.name, PrivilegeGroup.NONE);

        const query = { ...projectOptions, repository_name: repoInfo.name };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.forbiddenV2(response, 'Access prohibited');
      },
    );

    test(
      'GET /api/v2/projects/repos/repokey — 200 OK — Успешный вызов с помощью токена со скоупом repo',
      {
        tag: ['@VCS-12523', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);
        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const query = { ...projectOptions, repository_name: repoInfo.name };
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zSchemasRepoKey,
          data: {
            repo_key: repoInfo.repository_key,
          },
        });
      },
    );

    test(
      'GET /api/v2/projects/repos/repokey — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo',
      {
        tag: ['@VCS-12524', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);
        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const query = { ...projectOptions, repository_name: repoInfo.name };
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(PATH, { params: query });

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    [
      {
        title: 'Передан ключ несуществующего тенанта',
        generateQueryParams: (repoOptions: QueryParams, dg: DataGenerator) => {
          return {
            tenant_key: dg.uuid(),
            project_key: repoOptions.project_key,
            repository_name: repoOptions.repository_name,
          };
        },
        message: expect.stringContaining('Tenant not found'),
      },
      {
        title: 'Передан ключ несуществующего проекта',
        generateQueryParams: (repoOptions: QueryParams, dg: DataGenerator) => {
          return {
            tenant_key: repoOptions.tenant_key,
            project_key: dg.faker.string.ulid(),
            repository_name: repoOptions.repository_name,
          };
        },
        message: expect.stringContaining('Project not found'),
      },
      {
        title: 'Передано имя несуществующего репозитория',
        generateQueryParams: (repoOptions: QueryParams, dg: DataGenerator) => {
          return {
            tenant_key: repoOptions.tenant_key,
            project_key: repoOptions.project_key,
            repository_name: dg.faker.string.ulid(),
          };
        },
        message: expect.stringContaining('Repository not found'),
      },
    ].forEach(({ title, generateQueryParams, message }) => {
      test(
        `GET /api/v2/projects/repos/repokey — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-11019', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

          const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
          const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

          const realQueryParams = {
            tenant_key: tenantInfo.tenant_key,
            project_key: projectInfo.project_key,
            repository_name: repoInfo.name,
          };

          const requestParams = generateQueryParams(realQueryParams, dataGenerator);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(PATH, { params: requestParams });

          await HttpResponseAssertions.notFoundV2(response, message);
        },
      );
    });

    [
      {
        title: 'Передан пустой ключ тенанта',
        generateQueryParams: (repoOptions: QueryParams) => {
          return {
            tenant_key: '',
            project_key: repoOptions.project_key,
            repository_name: repoOptions.repository_name,
          };
        },
        message: undefined,
        errors: expect.arrayContaining([expect.stringContaining('tenant_key required')]),
      },
      {
        title: 'Передан пустой ключ проекта',
        generateQueryParams: (repoOptions: QueryParams) => {
          return {
            tenant_key: repoOptions.tenant_key,
            project_key: '',
            repository_name: repoOptions.repository_name,
          };
        },
        message: undefined,
        errors: [expect.stringContaining('project_key required')],
      },
      {
        title: 'Передано пустое имя репозитория',
        generateQueryParams: (repoOptions: QueryParams) => {
          return {
            tenant_key: repoOptions.tenant_key,
            project_key: repoOptions.project_key,
            repository_name: '',
          };
        },
        message: 'Repository identifier is empty',
        errors: undefined,
      },
    ].forEach(({ title, generateQueryParams, message, errors }) => {
      test(
        `GET /api/v2/projects/repos/repokey — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-11020', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

          const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
          const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

          const realQueryParams = {
            tenant_key: tenantInfo.tenant_key,
            project_key: projectInfo.project_key,
            repository_name: repoInfo.name,
          };

          const requestParams = generateQueryParams(realQueryParams);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(PATH, { params: requestParams });

          await HttpResponseAssertions.badRequestV2(response, message, errors);
        },
      );
    });
  },
);
