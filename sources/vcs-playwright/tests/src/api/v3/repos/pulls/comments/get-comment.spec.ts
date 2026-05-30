import { RepositoryV3ZodType, zComment, CommentZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const FIRST_PULL_INDEX = 1;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number, commentId: number | bigint) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/comments/${commentId}`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  commentId: bigint;
  commentInfo: CommentZodType;
}

test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: [Layer.API, '@v3', '@comments', '@get-comment'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach(
      'Создание PR с комментарием',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext, apiRegistry, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true, private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const [pullInfo, _] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const commentInfo = await commentsApi.createComment(repoOptions, Number(pullInfo.index), {
          body: dataGenerator.faker.lorem.sentence(),
        });

        testContext.put({
          repoOptions,
          repoInfo,
          commentId: commentInfo.id,
          commentInfo,
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 200 OK — Получение комментария`,
      {
        tag: ['@VCS-12175', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions, commentInfo, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);

        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zComment,
          data: commentInfo,
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-15036', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 200 OK — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-15037', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нет прав на получение комментария`,
      {
        tag: ['@VCS-12465', Priority.CRITICAL],
      },
      async ({ userPool, apiRegistry, testContext }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);

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
        tag: '@VCS-12460',
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: dg.uuid(),
            projectName: repoOptions.repoName,
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-12461',
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: dg.faker.string.ulid(),
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-12463',
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: repoOptions.projectName,
            repoName: dg.faker.string.ulid(),
          };
        },
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
      {
        tag: '@VCS-15034',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
      {
        tag: '@VCS-15035',
        title: 'Передан несуществующий commentId',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => BigInt(id) * 10n,
        generateDetailMessage: (_: RepoOptions) => expect.stringMatching(/Комментарий с таким index \d+ не найден/),
      },
    ].forEach(({ tag, title, generateRepoOptions, index, generateCommentId, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index, generateCommentId(commentId));

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
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: [Layer.API, '@v3', '@comments', '@get-comment'],
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12464', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX, dataGenerator.faker.number.int());
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12464', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX, dataGenerator.faker.number.int());
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
