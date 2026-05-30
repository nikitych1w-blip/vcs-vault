import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}/hooks`;

test.describe(
  'POST /api/v1/repos/:project/:repo/hooks',
  {
    tag: [Layer.API, '@v1', '@hooks', '@create-hook'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `POST /api/v1/repos/:project/:repo/hooks — 201 Created — Создание хука для репозитория`,
      {
        tag: ['@VCS-4447', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.created(response);
      },
    );
  },
);
