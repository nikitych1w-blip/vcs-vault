import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions, index: number) =>
  `/api/v1/repos/${projectName}/${repoName}/pulls/${index}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/pulls/:index',
  {
    tag: [Layer.API, '@v1', '@pulls', '@get-pull'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v1/repos/:project/:repo/pulls/:index — 200 OK — Получение PR по индексу`,
      {
        tag: ['@VCS-4465', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const [pullInfo, _] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, Number(pullInfo.index));
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            id: expect.any(Number),
            title: pullInfo.title,
            state: 'open',
            base: expect.objectContaining({
              sha: pullInfo.base.commit.hash,
              ref: pullInfo.base.name,
            }),
            head: expect.objectContaining({
              sha: pullInfo.head.commit.hash,
              ref: pullInfo.head.name,
            }),
          }),
        });
      },
    );
  },
);
