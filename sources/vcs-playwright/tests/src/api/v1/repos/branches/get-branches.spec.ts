import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}/branches`;

test.describe(
  'GET /api/v1/repos/:project/:repo/branches',
  {
    tag: [Layer.API, '@v1', '@get-branches'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/branches — 200 OK — Получение страницы списка веток с пагинацией (вызов с token)',
      {
        tag: ['@VCS-4415', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, dataGenerator, entityManager, apiRegistry }) => {
        const branchCount = 4;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const commitsApi = apiRegistry.v1.repos.commits.withToken(tuzToken);
        const commit = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const branchesApi = apiRegistry.v3.repos.branches.withToken(tuzToken);
        const branchPromises = Array.from({ length: branchCount }, () =>
          branchesApi.createBranch(repoOptions, {
            new_branch: dataGenerator.gitBranch(),
            parent_commit_SHA: commit,
          }),
        );
        await Promise.all(branchPromises);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path, { params: { limit, page: 3 } });

        await HttpResponseAssertions.ok(response, {
          data: expect.hasLength(limit),
        });

        const expectedUrl = `${response.config.baseURL}${path.slice(1)}`;
        expect(response).toHaveLinkHeader({
          next: `${expectedUrl}?limit=${limit}&page=4`,
          last: `${expectedUrl}?limit=${limit}&page=5`,
          first: `${expectedUrl}?limit=${limit}&page=1`,
          prev: `${expectedUrl}?limit=${limit}&page=2`,
        });
      },
    );

    test(
      'GET /api/v1/repos/:project/:repo/branches — 200 OK — Получение страницы списка веток с пагинацией (вызов через Basic)',
      {
        tag: ['@VCS-15554', Priority.CRITICAL],
      },
      async ({ user, privilegeService, tenantInfo, dataGenerator, entityManager, apiRegistry }) => {
        const branchCount = 4;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const commitsApi = apiRegistry.v1.repos.commits.withBasic(user);
        const commit = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const branchesApi = apiRegistry.v3.repos.branches.withBasic(user);
        const branchPromises = Array.from({ length: branchCount }, () =>
          branchesApi.createBranch(repoOptions, {
            new_branch: dataGenerator.gitBranch(),
            parent_commit_SHA: commit,
          }),
        );
        await Promise.all(branchPromises);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path, { params: { limit, page: 3 } });

        await HttpResponseAssertions.ok(response, {
          data: expect.hasLength(limit),
        });

        const expectedUrl = `${response.config.baseURL}${path.slice(1)}`;
        expect(response).toHaveLinkHeader({
          next: `${expectedUrl}?limit=${limit}&page=4`,
          last: `${expectedUrl}?limit=${limit}&page=5`,
          first: `${expectedUrl}?limit=${limit}&page=1`,
          prev: `${expectedUrl}?limit=${limit}&page=2`,
        });
      },
    );

    test(
      'GET /api/v1/repos/:project/:repo/branches — Полная выборка всех веток через рекурсивную пагинацию',
      {
        tag: ['@VCS-15555', Priority.NORMAL],
      },
      async ({ tuzToken, tenantInfo, dataGenerator, entityManager, apiRegistry }) => {
        const branchCount = 3;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const commitsApi = apiRegistry.v1.repos.commits.withToken(tuzToken);
        const commit = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const branchesApi = apiRegistry.v3.repos.branches.withToken(tuzToken);
        const branchPromises = Array.from({ length: branchCount }, () =>
          branchesApi.createBranch(repoOptions, {
            new_branch: dataGenerator.gitBranch(),
            parent_commit_SHA: commit,
          }),
        );
        await Promise.all(branchPromises);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);

        const data = await apiClient.getAllPaginated(path, limit);
        expect(data).toHaveLength(branchCount + 1); // +1 для default ветки
      },
    );

    [
      { tag: '@VCS-15556', title: 'неинициализированном', autoInit: false, expectedCount: 0 },
      { tag: '@VCS-15557', title: 'инициализированном', autoInit: true, expectedCount: 1 },
    ].forEach(({ tag, title, autoInit, expectedCount }) => {
      test(
        `GET /api/v1/repos/:project/:repo/branches — Получение списка веток в ${title} репозитории`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ tuzToken, tenantInfo, entityManager, apiRegistry }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: autoInit });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withToken(tuzToken);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.ok(response);
          expect(response).toHaveXTotalCountHeader(expectedCount);
        },
      );
    });
  },
);
