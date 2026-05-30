import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = (name: string) => `/api/v1/orgs/${name}`;

test.describe(
  'GET /api/v1/orgs/:name',
  {
    tag: [Layer.API, '@v1', '@get-org'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'GET /api/v1/orgs/:name — 200 OK — Получение информации о проекте по имени',
      {
        tag: ['@VCS-15564', Priority.CRITICAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const apiClient = apiRegistry.client.withToken(tuzToken);
        const path = toPath(projectInfo.name);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: {
            id: projectInfo.id,
            name: projectInfo.name,
            full_name: '',
            avatar_url: expect.stringContaining('avatars'),
            description: projectInfo.description,
            website: '',
            location: '',
            visibility: projectInfo.visibility === 2 ? 'private' : 'limited',
            repo_admin_change_team_access: false,
            username: projectInfo.name,
          },
        });
      },
    );
  },
);
