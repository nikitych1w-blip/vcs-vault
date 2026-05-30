import { zPaginatedLabelsList } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { RepoOptions as RepoOptionsV3 } from '@vcs-pw/api/v3';
import { RepoOptions } from '@vcs-pw/api/web';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { expect } from 'allure-playwright';

const toPath = ({ projectName, repoName }: RepoOptions) => `/web/v2/repos/${projectName}/${repoName}/labels`;

interface ThisTestContext {
  repoOptions: RepoOptionsV3;
}

test.describe(
  'GET /web/v2/repos/:owner/:repo/labels',
  {
    tag: [Layer.API, '@web', '@v2', '@get-labels'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach('Создание репозитория', async ({ tenantInfo, entityManager, testContext }) => {
      const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
      const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

      const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, issue_labels: undefined });
      const repoOptions = { ...projectOptions, repoName: repoInfo.name };

      testContext.put({ repoOptions });
    });

    test(
      `GET /web/v2/repos/:owner/:repo/labels — 200 OK — Получение списка меток`,
      {
        tag: ['@VCS-13161', Priority.CRITICAL],
      },
      async ({ user, testContext, apiRegistry, authService, privilegeService, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;
        const labelCount = 3;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const labelsApi = apiRegistry.v1.repos.labels.withBasic(user);
        const labelPromises = Array.from({ length: labelCount }, () =>
          labelsApi.createLabel(repoOptions, {
            name: dataGenerator.faker.lorem.word(),
            color: dataGenerator.faker.color.rgb(),
            description: dataGenerator.maybe(() => dataGenerator.faker.lorem.sentence()),
          }),
        );
        const labelInfos = await Promise.all(labelPromises);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const context = await authService.createAuthenticatedSession(user);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.get(path);

        const expectedLabelData = labelInfos.map((labelInfo) => ({
          color: `#${labelInfo.color}`,
          description: labelInfo.description,
          id: labelInfo.id,
          name: labelInfo.name,
        }));

        await HttpResponseAssertions.ok(response, {
          data: {
            data: expect.arrayContaining(expectedLabelData),
            pagination: {
              current_page: 1,
              first_item: 1,
              last_item: labelCount,
              next_page: null,
              per_page: 20,
              previous_page: null,
              total_items: labelCount,
              total_pages: 1,
            },
          },
          zodSchema: zPaginatedLabelsList,
          xRequestIdHeader: false,
        });
      },
    );

    test(
      `GET /web/v2/repos/:owner/:repo/labels — 401 Unauthorized — Заголовок Authorization отсутствует`,
      {
        tag: ['@VCS-13194', Priority.CRITICAL],
      },
      async ({ apiRegistry, dataGenerator }) => {
        const fakeRepoOptions = {
          projectName: dataGenerator.faker.string.ulid(),
          repoName: dataGenerator.faker.string.ulid(),
        };

        const path = toPath(fakeRepoOptions);
        const apiClient = apiRegistry.client.anonymous();

        const response = await apiClient.get(path);

        await HttpResponseAssertions.unauthorizedWeb(response);
      },
    );

    test(
      `GET /web/v2/repos/:owner/:repo/labels — 403 Forbidden — Нет прав на выполнение запроса`,
      {
        tag: ['@VCS-13195', Priority.CRITICAL],
      },
      async ({ apiRegistry, testContext, user, authService }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenWeb(response);
      },
    );
  },
);
