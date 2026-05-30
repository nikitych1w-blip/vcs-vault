import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions, hookId: number | bigint) =>
  `/api/v1/repos/${projectName}/${repoName}/hooks/${hookId}`;

test.describe(
  'DELETE /api/v1/repos/:project/:repo/hooks/:hookId',
  {
    tag: [Layer.API, '@v1', '@hooks', '@delete-hook'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `DELETE /api/v1/repos/:project/:repo/hooks/:hookId — 204 No Content — Удаление хука репозитория`,
      {
        tag: ['@VCS-15753', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
        const hooksApi = apiRegistry.v1.repos.hooks.withToken(tuzToken);
        const hookInfo = await hooksApi.createHook(repoOptions, request);

        const path = toPath(repoOptions, hookInfo.id);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );
  },
);
