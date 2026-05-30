import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}`;

test.describe(
  'GET /api/v1/repos/:project/:repo',
  {
    tag: [Layer.API, '@v1', '@get-repo'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v1/repos/:owner/:repo — 200 OK — Получение репозитория по владельцу и названию`,
      {
        tag: ['@VCS-4428', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, apiRegistry, entityManager }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            owner: expect.objectContaining({
              username: projectInfo.name,
            }),
            name: repoInfo.name,
            description: repoInfo.description,
            parent: null,
            mirror: false,
            html_url: repoInfo.links.html,
            ssh_url: repoInfo.links.ssh,
            clone_url: repoInfo.links.clone,
            original_url: '',
            website: '',
            default_branch: repoInfo.default_branch,
            permissions: {
              admin: true,
              push: true,
              pull: true,
            },
            avatar_url: '',
          }),
        });
      },
    );
  },
);
