import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (projectName: string) => `/api/v1/orgs/${projectName}/repos`;

test.describe(
  'GET /api/v1/orgs/:project/repos',
  {
    tag: [Layer.API, '@v1', '@get-repos'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/orgs/:project/repos — 200 OK — Получение списка репозиториев с пагинацией',
      {
        tag: ['@VCS-15388', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, entityManager, apiRegistry }) => {
        const repoCount = 5;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoPromises = Array.from({ length: repoCount }, () => entityManager.createRepoV3(projectOptions));
        await Promise.all(repoPromises);

        const path = toPath(projectInfo.name);
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
  },
);
