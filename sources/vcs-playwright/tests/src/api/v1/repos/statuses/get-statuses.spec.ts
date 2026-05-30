import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions, sha: string) =>
  `/api/v1/repos/${projectName}/${repoName}/statuses/${sha}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/statuses/:sha',
  {
    tag: [Layer.API, '@v1', '@get-commit-statuses'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/statuses/:sha — 200 OK — Получение статусов коммита с пагинацией',
      {
        tag: ['@VCS-4419', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, entityManager, apiRegistry, dataGenerator }) => {
        const statusCount = 5;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const commitsApi = apiRegistry.v1.repos.commits.withToken(tuzToken);
        const commitSha = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const commitStatusApi = apiRegistry.v3.repos.commits.statuses.withToken(tuzToken);
        const statusPromises = Array.from({ length: statusCount }, () => {
          const request = dataGenerator.createCommitStatusRequest();
          return commitStatusApi.createCommitStatus(repoOptions, commitSha, request);
        });
        await Promise.all(statusPromises);

        const path = toPath(repoOptions, commitSha);
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
