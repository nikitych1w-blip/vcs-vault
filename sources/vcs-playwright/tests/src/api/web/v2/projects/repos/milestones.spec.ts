import { zPaginatedMilestonesList } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { RepoOptions as RepoOptionsV3 } from '@vcs-pw/api/v3';
import { RepoOptions } from '@vcs-pw/api/web';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { getRandomElement } from '@vcs-pw/utils/object.util';
import { expect } from 'allure-playwright';

const MILESTONE_STATUSES = ['open', 'closed'] as const;
const toPath = ({ projectName, repoName }: RepoOptions) => `/web/v2/repos/${projectName}/${repoName}/milestones`;

interface ThisTestContext {
  repoOptions: RepoOptionsV3;
}

test.describe(
  'GET /web/v2/repos/:owner/:repo/milestones',
  {
    tag: [Layer.API, '@web', '@v2', '@get-milestones'],
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
      `GET /web/v2/repos/:owner/:repo/milestones — 200 OK — Получение списка этапов`,
      {
        tag: ['@VCS-13647', Priority.CRITICAL],
      },
      async ({ user, testContext, apiRegistry, authService, privilegeService, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;
        const milestoneCount = 3;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const milestonesApi = apiRegistry.v1.repos.milestones.withBasic(user);
        const milestonePromises = Array.from({ length: milestoneCount }, () =>
          milestonesApi.createMilestone(repoOptions, {
            title: dataGenerator.faker.lorem.word(),
            description: dataGenerator.maybe(() => dataGenerator.faker.lorem.sentence()),
            state: dataGenerator.maybe(() => getRandomElement(MILESTONE_STATUSES)),
            due_on: dataGenerator.maybe(() => dataGenerator.faker.date.anytime().toISOString()),
          }),
        );
        const milestoneInfos = await Promise.all(milestonePromises);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const context = await authService.createAuthenticatedSession(user);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.get(path);

        const expectedMilestoneData = milestoneInfos.map((milestoneInfo) => ({
          id: milestoneInfo.id,
          name: milestoneInfo.title,
          description: milestoneInfo.description,
          due_date: milestoneInfo.due_on,
          state: milestoneInfo.state,
        }));

        await HttpResponseAssertions.ok(response, {
          data: {
            data: expect.arrayContaining(expectedMilestoneData),
            pagination: {
              current_page: 1,
              first_item: 1,
              last_item: milestoneCount,
              next_page: null,
              per_page: 20,
              previous_page: null,
              total_items: milestoneCount,
              total_pages: 1,
            },
          },
          zodSchema: zPaginatedMilestonesList,
          xRequestIdHeader: false,
        });
      },
    );

    test(
      `GET /web/v2/repos/:owner/:repo/milestones — 401 Unauthorized — Заголовок Authorization отсутствует`,
      {
        tag: ['@VCS-13654', Priority.CRITICAL],
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
      `GET /web/v2/repos/:owner/:repo/milestones — 403 Forbidden — Нет прав на выполнение запроса`,
      {
        tag: ['@VCS-13655', Priority.CRITICAL],
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
