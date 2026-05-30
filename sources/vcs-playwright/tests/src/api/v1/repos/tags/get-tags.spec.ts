import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}/tags`;

test.describe(
  'GET /api/v1/repos/:project/:repo/tags',
  {
    tag: [Layer.API, '@v1', '@get-tags'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/repos/:project/:repo/tags — 200 OK — Получение списка тегов репозитория с пагинацией',
      {
        tag: ['@VCS-4475', Priority.CRITICAL],
      },
      async ({ privilegeService, user, tenantInfo, dataGenerator, entityManager, apiRegistry, gitService }) => {
        const tagCount = 5;
        const limit = 1;

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        for (let i = 0; i < tagCount; i++) {
          const tagName = dataGenerator.uuid();
          const message = dataGenerator.faker.git.commitMessage();

          const addTagResult = await git.addAnnotatedTag(tagName, message, repoInfo.default_branch);
          expect(addTagResult).toBeOk();
        }

        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const pushTagsResult = await git.pushTags();
          expect(pushTagsResult).toBeOk();
        });

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
      'GET /api/v1/repos/:project/:repo/tags — 200 OK — Получение пустого списка тегов репозитория',
      {
        tag: ['@VCS-4474', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, entityManager, apiRegistry }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.hasLength(0),
        });
      },
    );
  },
);
