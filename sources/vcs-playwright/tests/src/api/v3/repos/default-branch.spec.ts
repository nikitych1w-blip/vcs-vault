import { zDefaultBranchResult } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/default-branch`;

test.describe(
  'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch',
  {
    tag: [Layer.API, '@v3', '@default-branch'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 200 OK — Обновление ветки по умолчанию в инициализированном репозитории',
      {
        tag: ['@VCS-9658', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const commitsApi = apiRegistry.v1.repos.commits.withBasic(user);
        const commit = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const newBranchRequest = {
          new_branch: dataGenerator.faker.string.alphanumeric({ length: { min: 1, max: 100 } }),
          parent_commit_SHA: commit,
        };
        const branchesApi = apiRegistry.v3.repos.branches.withBasic(user);
        const createdBranch = await branchesApi.createBranch(repoOptions, newBranchRequest);

        const request = { default_branch: createdBranch.name };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.put(toPath(repoOptions), request);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zDefaultBranchResult,
          data: request,
        });

        await step('Ветка по умолчанию обновилась в репозитории', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
          const updatedRepoInfo = await reposApi.getRepo(repoOptions);
          expect(updatedRepoInfo.default_branch).toEqual(request.default_branch);
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
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9659', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const request = { default_branch: dataGenerator.gitBranch() };
          const response = await apiClient.put(path, request, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });

    [
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      // Вынесены случаи в отдельный тест, поскольку объект ошибки возвращается старого формата
      test(
        `PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9659', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const request = { default_branch: dataGenerator.gitBranch() };
          const response = await apiClient.put(path, request, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии edit',
      {
        tag: ['@VCS-9660', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const request = { default_branch: dataGenerator.gitBranch() };
        const response = await apiClient.put(path, request);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии edit с токеном со скоупом repo',
      {
        tag: ['@VCS-9661', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const request = { default_branch: dataGenerator.gitBranch() };
        const response = await apiClient.put(path, request);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo',
      {
        tag: ['@VCS-9662', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const request = { default_branch: dataGenerator.gitBranch() };
        const response = await apiClient.put(path, request);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 200 OK — Обновление ветки по умолчанию на выставленную ранее',
      {
        tag: ['@VCS-9663', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const request = { default_branch: repoInfo.default_branch };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.put(toPath(repoOptions), request);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zDefaultBranchResult,
          data: request,
        });
      },
    );

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 200 OK — Выполнение запроса с токеном со скоупом repo',
      {
        tag: ['@VCS-9664', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const request = { default_branch: repoInfo.default_branch };

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.put(toPath(repoOptions), request);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zDefaultBranchResult,
          data: request,
        });
      },
    );

    test(
      'PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 404 Not Found — Нельзя задать по умолчанию несуществующую ветку',
      {
        tag: ['@VCS-9665', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const request = { default_branch: dataGenerator.gitBranch() };
        const response = await apiClient.put(path, request);

        await HttpResponseAssertions.notFound(response, {
          detail: `Ветка с таким именем ${request.default_branch} не найдена`,
          instance: path,
        });
      },
    );

    [
      {
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (
          _: { id: string },
          projectInfo: { name: string },
          repoInfo: { name: string },
          dg: DataGenerator,
        ) => {
          return { tenantId: dg.uuid(), projectName: projectInfo.name, repoName: repoInfo.name };
        },
        generateDetailMessage: (_: RepoOptions) => `Тенант с таким UUID не найден`,
      },
      {
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (
          tenantInfo: { id: string },
          _: { name: string },
          repoInfo: { name: string },
          dg: DataGenerator,
        ) => {
          return { tenantId: tenantInfo.id, projectName: dg.faker.string.ulid(), repoName: repoInfo.name };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (
          tenantInfo: { id: string },
          projectInfo: { name: string },
          _: { name: string },
          dg: DataGenerator,
        ) => {
          return { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: dg.faker.string.ulid() };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
    ].forEach(({ title, generateRepoOptions, generateDetailMessage }) => {
      test(
        `PUT /api/v3/repos/:tenant/:owner/:repo/default-branch — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-9686', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

          const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
          const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

          const repoOptions = generateRepoOptions(tenantInfo, projectInfo, repoInfo, dataGenerator);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const request = { default_branch: dataGenerator.gitBranch() };
          const response = await apiClient.put(path, request);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(repoOptions),
            instance: path,
          });
        },
      );
    });
  },
);
