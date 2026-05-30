import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions, sha: string) =>
  `/api/v1/repos/${projectName}/${repoName}/git/commits/${sha}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/commits',
  {
    tag: [Layer.API, '@v1', '@get-commit-by-sha'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/git/commits/:sha — 200 OK — Получение коммита по SHA1',
      {
        tag: ['@VCS-15747', Priority.CRITICAL],
      },
      async ({ tenantInfo, entityManager, apiRegistry, privilegeService, user }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
          gitignores: undefined,
          license: undefined,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const commitsApi = apiRegistry.v1.repos.commits.withBasic(user);
        const commitSha = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const path = toPath(repoOptions, commitSha);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            sha: commitSha,
            commit: expect.objectContaining({
              committer: expect.objectContaining({
                date: expect.stringIso(),
              }),
            }),
          }),
        });
      },
    );
  },
);
