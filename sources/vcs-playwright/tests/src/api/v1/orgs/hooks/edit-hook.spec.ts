import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (projectName: string, hookId: number | bigint) => `/api/v1/orgs/${projectName}/hooks/${hookId}`;

test.describe(
  'PATCH /api/v1/orgs/:project/hooks/:hookId',
  {
    tag: [Layer.API, '@v1', '@hooks', '@edit-hook'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `PATCH /api/v1/orgs/:project/hooks/:hookId — 200 OK — Обновление хука проекта`,
      {
        tag: ['@VCS-15757', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const request = { type: 'sourcecontrol', ...dataGenerator.createHookRequest() };
        const hooksApi = apiRegistry.v1.orgs.hooks.withToken(tuzToken);
        const hookInfo = await hooksApi.createHook(projectInfo.name, request);

        const path = toPath(projectInfo.name, hookInfo.id);
        const updateRequest = dataGenerator.createHookRequest();

        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.patch(path, updateRequest);

        await HttpResponseAssertions.ok(response, {
          data: {
            id: hookInfo.id,
            config: {
              content_type: updateRequest.config.content_type,
              secret: updateRequest.config.secret ?? '',
              url: updateRequest.config.url,
            },
            events: updateRequest.events,
            authorization_header: updateRequest.authorization_header ?? '',
            active: !!updateRequest.active,
            branch_filter: updateRequest.branch_filter ?? '',
            updated_at: expect.stringIso(),
            created_at: expect.stringIso(),
          },
        });
      },
    );
  },
);
