import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (projectName: string) => `/api/v1/orgs/${projectName}/hooks`;

test.describe(
  'POST /api/v1/orgs/:project/hooks',
  {
    tag: [Layer.API, '@v1', '@hooks', '@create-hook'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `POST /api/v1/orgs/:project/hooks — 201 Created — Создание хука для проекта`,
      {
        tag: ['@VCS-15756', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
        const path = toPath(projectInfo.name);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.created(response);
      },
    );
  },
);
