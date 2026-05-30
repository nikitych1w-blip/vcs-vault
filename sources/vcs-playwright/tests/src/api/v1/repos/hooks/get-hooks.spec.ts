import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}/hooks`;

test.describe(
  'GET /api/v1/repos/:project/:repo/hooks',
  {
    tag: [Layer.API, '@v1', '@hooks', '@get-hooks'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v1/repos/:project/:repo/hooks — 200 OK — Получения списка хуков репозитория с пагинацией`,
      {
        tag: ['@VCS-15754', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const hookCount = 5;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const hookPromises = Array.from({ length: hookCount }, () => {
          const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
          const hooksApi = apiRegistry.v1.repos.hooks.withToken(tuzToken);
          return hooksApi.createHook(repoOptions, request);
        });
        await Promise.all(hookPromises);

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
      `GET /api/v1/repos/:project/:repo/hooks — 200 OK — Получения пустого списка хуков репозитория`,
      {
        tag: ['@VCS-15755', Priority.NORMAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, { data: [] });
      },
    );
  },
);
