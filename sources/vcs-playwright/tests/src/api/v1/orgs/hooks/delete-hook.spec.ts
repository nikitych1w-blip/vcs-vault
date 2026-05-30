import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (projectName: string, hookId: number | bigint) => `/api/v1/orgs/${projectName}/hooks/${hookId}`;

test.describe(
  'DELETE /api/v1/orgs/:project/hooks/:hookId',
  {
    tag: [Layer.API, '@v1', '@hooks', '@delete-hook'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `DELETE /api/v1/orgs/:project/hooks/:hookId — 204 No Content — Удаление хука проекта`,
      {
        tag: ['@VCS-15758', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
        const hooksApi = apiRegistry.v1.orgs.hooks.withToken(tuzToken);
        const hookInfo = await hooksApi.createHook(projectInfo.name, request);

        const path = toPath(projectInfo.name, hookInfo.id);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );
  },
);
