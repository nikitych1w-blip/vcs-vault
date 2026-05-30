import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions, branch: string) =>
  `/api/v1/repos/${projectName}/${repoName}/branches/${branch}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/branches/:branch',
  {
    tag: [Layer.API, '@v1', '@get-branch'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/branches/:branch — 200 OK — Получение информации о конкретной ветке',
      {
        tag: ['@VCS-4416', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, entityManager, apiRegistry }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions, repoInfo.default_branch);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            name: repoInfo.default_branch,
            commit: expect.objectContaining({
              id: expect.hasLength(40),
            }),
          }),
        });
      },
    );
  },
);
