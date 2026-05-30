import { PrInfoZodType, RepositoryV3ZodType, zCommentListResponse } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { callNTimesWithDelay, sortByFields } from '@vcs-pw/utils/object.util';

const FIRST_PULL_INDEX = 1;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number | bigint) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/comments`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  pullInfo: PrInfoZodType;
}

test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments',
  {
    tag: [Layer.API, '@v3', '@comments', '@get-comments'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach('Создание PR', async ({ tenantInfo, entityManager, privilegeService, user, testContext }) => {
      const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
      const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

      const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true, private: true });
      const repoOptions = { ...projectOptions, repoName: repoInfo.name };

      await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

      const [pullInfo, _] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

      testContext.put({
        repoOptions,
        repoInfo,
        pullInfo,
      });
    });

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Получение пустого списка комментариев`,
      {
        tag: ['@VCS-11293', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);

        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCommentListResponse,
          data: {
            comments: [],
            pagination: {
              current_page: 1,
              per_page: 30,
              total_pages: 1,
              total_items: 0,
            },
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-15043', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-15042', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 403 Forbidden — Нет прав на получение списака комментариев`,
      {
        tag: ['@VCS-15041', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        const path = toPath(repoOptions, FIRST_PULL_INDEX);

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
        tag: '@VCS-11309',
        type: 'COMMENTED',
      },
      {
        tag: '@VCS-11305',
        type: 'REQUEST_CHANGES',
      },
      {
        tag: '@VCS-11294',
        type: 'APPROVED',
      },
    ].forEach(({ tag, type }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Фильтрация комментариев по типу (${type})`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ apiRegistry, testContext, user, dataGenerator }) => {
          const { repoOptions, pullInfo } = testContext as unknown as ThisTestContext;

          const pullIndex = Number(pullInfo.index);
          const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
          const simpleComment = await commentsApi.createComment(repoOptions, pullIndex, {
            body: dataGenerator.faker.lorem.sentence(),
          });
          const approvedComment = await commentsApi.createComment(repoOptions, pullIndex, {
            body: dataGenerator.faker.lorem.sentence(),
            type: 'APPROVED',
          });
          const rejectComment = await commentsApi.createComment(repoOptions, pullIndex, {
            body: dataGenerator.faker.lorem.sentence(),
            type: 'REQUEST_CHANGES',
          });

          const expectedComments = [simpleComment, approvedComment, rejectComment].filter(
            (comment) => comment.type === type,
          );

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, {
            params: {
              state: type,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCommentListResponse,
            data: {
              comments: expectedComments,
              pagination: {
                current_page: 1,
                per_page: 30,
                total_pages: 1,
                total_items: 1,
              },
            },
          });
        },
      );
    });

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Сортировка комментариев по типу`,
      {
        tag: ['@VCS-11643', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, user, dataGenerator }) => {
        const { repoOptions, pullInfo } = testContext as unknown as ThisTestContext;

        const pullIndex = Number(pullInfo.index);
        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const simpleComment = await commentsApi.createComment(repoOptions, pullIndex, {
          body: dataGenerator.faker.lorem.sentence(),
        });
        const rejectComment = await commentsApi.createComment(repoOptions, pullIndex, {
          body: dataGenerator.faker.lorem.sentence(),
          type: 'REQUEST_CHANGES',
        });
        const approvedComment = await commentsApi.createComment(repoOptions, pullIndex, {
          body: dataGenerator.faker.lorem.sentence(),
          type: 'APPROVED',
        });

        const expectedComments = [approvedComment, simpleComment, rejectComment];

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path, {
          params: {
            sort: 'state',
          },
        });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCommentListResponse,
          data: {
            comments: expectedComments,
            pagination: expect.objectContaining({
              total_items: 3,
            }),
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Сортировка комментариев по дате создания`,
      {
        tag: ['@VCS-11642', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, user, dataGenerator }) => {
        const { repoOptions, pullInfo } = testContext as unknown as ThisTestContext;

        const commentCount = 3;
        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);

        // Делаем синхронно для разной created_at даты
        const commentInfos = await callNTimesWithDelay(
          () =>
            commentsApi.createComment(repoOptions, Number(pullInfo.index), {
              body: dataGenerator.faker.lorem.sentence(),
            }),
          commentCount,
          1000,
        );
        const sortedCommentInfos = sortByFields(commentInfos, ['created_at:asc']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path, {
          params: {
            sort: 'created_at',
          },
        });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCommentListResponse,
          data: {
            comments: sortedCommentInfos,
            pagination: expect.objectContaining({
              total_items: 3,
            }),
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Сортировка комментариев по дате обновления`,
      {
        tag: ['@VCS-11641', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, user, dataGenerator }) => {
        const { repoOptions, pullInfo } = testContext as unknown as ThisTestContext;

        const commentCount = 3;
        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);

        // Делаем синхронно для разной updated_at даты
        const commentInfos = await callNTimesWithDelay(
          () =>
            commentsApi.createComment(repoOptions, Number(pullInfo.index), {
              body: dataGenerator.faker.lorem.sentence(),
            }),
          commentCount,
          1000,
        );
        const sortedCommentInfos = sortByFields(commentInfos, ['updated_at:asc']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path, {
          params: {
            sort: 'updated_at',
          },
        });

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCommentListResponse,
          data: {
            comments: sortedCommentInfos,
            pagination: expect.objectContaining({
              total_items: 3,
            }),
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 200 OK — Пагинация комментариев`,
      {
        tag: ['@VCS-11298', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions, pullInfo } = testContext as unknown as ThisTestContext;

        const commentCount = 3;
        const limit = 2;
        const totalPages = Math.ceil(commentCount / limit);

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const commentPromises = Array.from({ length: commentCount }, () =>
          commentsApi.createComment(repoOptions, Number(pullInfo.index), {
            body: dataGenerator.faker.lorem.sentence(),
          }),
        );
        const commentInfos = await Promise.all(commentPromises);
        const sortedCommentInfos = sortByFields(commentInfos, ['created_at']);

        const path = toPath(repoOptions, pullInfo.index);
        const apiClient = apiRegistry.client.withBasic(user);

        await step('Получение 1-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              page: 1,
              limit,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCommentListResponse,
            data: {
              comments: sortedCommentInfos.slice(0, limit),
              pagination: {
                current_page: 1,
                per_page: limit,
                total_pages: totalPages,
                total_items: commentCount,
              },
            },
          });
        });

        await step('Получение 2-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              page: 2,
              limit,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCommentListResponse,
            data: {
              pagination: {
                current_page: 2,
                per_page: limit,
                total_pages: totalPages,
                total_items: commentCount,
              },
              comments: sortedCommentInfos.slice(limit),
            },
          });
        });
      },
    );

    [
      {
        tag: '@VCS-15040',
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: dg.uuid(),
            projectName: repoOptions.repoName,
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-11320',
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: dg.faker.string.ulid(),
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-11321',
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: repoOptions.projectName,
            repoName: dg.faker.string.ulid(),
          };
        },
        index: FIRST_PULL_INDEX,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
      {
        tag: '@VCS-11326',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
      {
        tag: '@VCS-11302',
        title: 'Передан номер несуществующей страницы',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        page: 2,
        generateDetailMessage: (_: RepoOptions) => 'Страница 2 не найдена',
      },
    ].forEach(({ tag, title, generateRepoOptions, index, generateDetailMessage, page }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, {
            params: {
              page,
            },
          });

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(fakeRepoOptions),
            instance: path,
          });
        },
      );
    });

    [
      {
        tag: '@VCS-15052',
        title: 'Передано значение лимита 0',
        generateParams: (_: DataGenerator) => ({ limit: 0 }),
        generateDetailMessage: (_: object) => 'get comments: limit: min value 1',
      },
      {
        tag: '@VCS-11301',
        title: 'Передано значение лимита 101',
        generateParams: (_: DataGenerator) => ({ limit: 101 }),
        generateDetailMessage: (_: object) => 'get comments: limit: max value 100',
      },
      {
        tag: '@VCS-15049',
        title: 'Передано значение страницы 0',
        generateParams: (_: DataGenerator) => ({ page: 0 }),
        generateDetailMessage: (_: object) => 'get comments: page: min value 1',
      },
      {
        tag: '@VCS-15050',
        title: 'Передано значение невалидное значение sort',
        generateParams: (dg: DataGenerator) => ({ sort: dg.faker.lorem.word() }),
        generateDetailMessage: (_: object) => 'get comments: sort: unsupported value',
      },
      {
        tag: '@VCS-15051',
        title: 'Передано значение невалидное значение state',
        generateParams: (dg: DataGenerator) => ({ state: dg.faker.lorem.word() }),
        generateDetailMessage: (_: object) => 'get comments: state: unsupported value',
      },
    ].forEach(({ tag, title, generateParams, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 400 Bad Request — ${title}`,
        {
          tag: [tag, Priority.MINOR],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const params = generateParams(dataGenerator);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, {
            params,
          });

          await HttpResponseAssertions.badRequest(response, {
            detail: generateDetailMessage(params),
            instance: path,
          });
        },
      );
    });
  },
);

// Не нужен beforeEach с созданием PR
test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments',
  {
    tag: ['@v3', '@comments', '@get-comments'],
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 401 Unauthorized — ${title}`,
        {
          tag: [Layer.API, '@VCS-11314', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX);
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 401 Unauthorized — ${title}`,
        {
          tag: [Layer.API, '@VCS-11314', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX);
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
