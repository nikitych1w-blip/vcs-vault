import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions, sha: string) =>
  `/api/v1/repos/${projectName}/${repoName}/git/tags/${sha}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/tags',
  {
    tag: [Layer.API, '@v1', '@get-tag-by-sha'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/git/tags/:sha — 200 OK — Получение аннотированного тега по SHA1',
      {
        tag: ['@VCS-15746', Priority.CRITICAL],
      },
      async ({ tenantInfo, entityManager, apiRegistry, privilegeService, user, gitService, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const tagName = dataGenerator.uuid();
        const message = dataGenerator.faker.git.commitMessage();

        const addTagResult = await git.addAnnotatedTag(tagName, message, repoInfo.default_branch);
        expect(addTagResult).toBeOk();

        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const pushTagsResult = await git.pushTags();
          expect(pushTagsResult).toBeOk();
        });

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const path = toPath(repoOptions, defaultSha);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            sha: defaultSha,
            tag: tagName,
            tagger: expect.objectContaining({
              date: expect.stringIso(),
            }),
          }),
        });
      },
    );
  },
);
