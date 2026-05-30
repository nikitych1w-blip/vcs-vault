import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions, sha: string) =>
  `/api/v1/repos/${projectName}/${repoName}/statuses/${sha}`;

test.describe(
  'POST /api/v1/repos/:project/:repo/statuses/:sha',
  {
    tag: [Layer.API, '@v1', '@create-commit-status'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'POST /api/v1/repos/:project/:repo/statuses/:sha — 201 Created — Создание нового статуса коммита по хэшу коммита',
      {
        tag: ['@VCS-15748', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, entityManager, apiRegistry, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const commitsApi = apiRegistry.v1.repos.commits.withToken(tuzToken);
        const commitSha = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const path = toPath(repoOptions, commitSha);
        const request = dataGenerator.createCommitStatusRequest();
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.created(response);
      },
    );
  },
);
