import { zRepositorySubscription } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/subscription`;

interface ThisTestContext {
  repoOptions: RepoOptions;
}

test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/subscription',
  {
    tag: [Layer.API, '@v3', '@get-subscription'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach(
      'Создание приватного репозитория',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        testContext.put({
          repoOptions,
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/subscription — 200 OK — Получение сконфигурированных настроек подписки на репозиторий`,
      {
        tag: ['@VCS-14125', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, testContext, authService, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);

        const reposReactWebApi = apiRegistry.web.v2.projects.repos.repos.withRequest(context.request);

        const subscribeOptions = dataGenerator.subscribeRepoRequest();
        await reposReactWebApi.subscribe(repoOptions, subscribeOptions);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zRepositorySubscription,
          data: {
            is_watching: subscribeOptions.is_watching,
            events: {
              pull_review_request: subscribeOptions.pull_review_request,
              pull_request_review: subscribeOptions.pull_request_review,
              pull_review_dismiss: subscribeOptions.pull_review_dismiss,
              new_pull_request: subscribeOptions.new_pull_request,
              merge_pull_request: subscribeOptions.merge_pull_request,
              pull_request_push_commits: subscribeOptions.pull_request_push_commits,
              pull_request_code_comment: subscribeOptions.pull_request_code_comment,
            },
            email_notifications: subscribeOptions.email_notifications,
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/subscription — 404 Not Found — Отсутствуют настройки подписки по умолчанию`,
      {
        tag: ['@VCS-14571', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.notFound(response, {
          detail: `Подписка для репозитория ${repoOptions.repoName} не найдена`,
          instance: path,
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/subscription — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-15128', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/subscription — 200 OK — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-15127', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext, authService, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const reposReactWebApi = apiRegistry.web.v2.projects.repos.repos.withRequest(context.request);

        const subscribeOptions = dataGenerator.subscribeRepoRequest();
        await reposReactWebApi.subscribe(repoOptions, subscribeOptions);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/subscription — 403 Forbidden — Нет прав на получение настроек подписки`,
      {
        tag: ['@VCS-14567', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    [
      {
        tag: '@VCS-14570',
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: dg.uuid(),
            projectName: repoOptions.repoName,
            repoName: repoOptions.repoName,
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-14568',
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: dg.faker.string.ulid(),
            repoName: repoOptions.repoName,
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-14569',
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: repoOptions.projectName,
            repoName: dg.faker.string.ulid(),
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
    ].forEach(({ tag, title, generateRepoOptions, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/subscription — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(fakeRepoOptions),
            instance: path,
          });
        },
      );
    });
  },
);

// Не нужен beforeEach с созданием PR
test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/subscription',
  {
    tag: [Layer.API, '@v3', '@get-subscription'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    [
      {
        title: 'Заголовок Authorization отсутствует',
        generateAuthHeader: (_: DataGenerator) => {
          return {};
        },
      },
      {
        title: 'Заголовок Authorization имеет пустое значение',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: '' };
        },
      },
      {
        title: 'Заголовок Authorization имеет невалидный token',
        generateAuthHeader: (dg: DataGenerator) => {
          return { Authorization: `token ${dg.faker.string.alphanumeric(40)}` };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/subscription — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-14572', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });

    [
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/subscription — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-14572', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });
  },
);
