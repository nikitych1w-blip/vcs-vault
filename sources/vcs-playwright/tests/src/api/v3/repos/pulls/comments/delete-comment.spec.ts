import { PrInfoZodType, RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { Endpoint } from '@vcs-pw/ui';

const FIRST_PULL_INDEX = 1;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number, commentId: number | bigint) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/comments/${commentId}`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  commentId: bigint;
  git: GitWrapper;
  pullInfo: PrInfoZodType;
}

test.describe(
  'DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: [Layer.API, '@v3', '@comments', '@delete-comment'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach(
      'Создание PR с комментарием',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext, apiRegistry, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const [pullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const comment = await commentsApi.createComment(repoOptions, Number(pullInfo.index), {
          body: dataGenerator.faker.lorem.sentence(),
        });

        testContext.put({
          pullInfo,
          repoOptions,
          repoInfo,
          commentId: comment.id,
          git,
        });
      },
    );

    [
      {
        tag: '@VCS-11380',
        privilegeGroup: PrivilegeGroup.WRITER,
      },
      {
        tag: '@VCS-14527',
        privilegeGroup: PrivilegeGroup.READ_APPROVE,
      },
      {
        tag: '@VCS-14528',
        privilegeGroup: PrivilegeGroup.READ_CREATE,
      },
      {
        tag: '@VCS-14529',
        privilegeGroup: PrivilegeGroup.READ_MERGE,
      },
    ].forEach(({ tag, privilegeGroup }) => {
      test(
        `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 204 No Content — Удаление собственного комментария (${privilegeGroup})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, testContext, privilegeService }) => {
          const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

          await privilegeService.grantToRepo(repoOptions, user.name, privilegeGroup);

          const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.delete(path);

          await HttpResponseAssertions.noContent(response);

          const getResponse = await apiClient.get(path);
          await HttpResponseAssertions.notFound(getResponse);
        },
      );
    });

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-14541', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 204 No Content — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-14540', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нельзя удалить собственный комментарий при отсутствии привилегий`,
      {
        tag: ['@VCS-11387', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нельзя удалить комментарий другого пользователя при отстутствии привилегии manage_comments`,
      {
        tag: ['@VCS-11388', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, privilegeService, userPool }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.WRITER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: `Недостаточно прав для взаимодействия с комментарием ${commentId}`,
          instance: path,
        });
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 204 No Content — Удаление комментария другого пользователя при наличии привилегии manage_comments`,
      {
        tag: ['@VCS-14545', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, privilegeService, userPool }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.MANAGER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 404 Not Found — Повторное удаление комментария`,
      {
        tag: ['@VCS-14546', Priority.MINOR],
      },
      async ({ apiRegistry, testContext, user }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);

        const secondResponse = await apiClient.delete(path);
        await HttpResponseAssertions.notFound(secondResponse);
      },
    );

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 204 No Content — Удаление комментария с ответами`,
      {
        tag: ['@VCS-14547', Priority.MINOR],
      },
      async ({ apiRegistry, testContext, user, userPool, dataGenerator, privilegeService }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.WRITER);

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(otherUser);
        await commentsApi.createComment(repoOptions, FIRST_PULL_INDEX, {
          body: dataGenerator.faker.lorem.word(),
          reply_to: commentId,
        });

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );

    [
      {
        tag: '@VCS-11382',
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
        tag: '@VCS-11383',
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
        tag: '@VCS-11384',
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
        tag: '@VCS-11385',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
      {
        tag: '@VCS-11386',
        title: 'Передан несуществующий commentId',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => BigInt(id) * 10n,
        generateDetailMessage: (_: RepoOptions) => expect.stringMatching(/Комментарий с таким index \d+ не найден/),
      },
    ].forEach(({ tag, title, generateRepoOptions, index, generateCommentId, generateDetailMessage }) => {
      test(
        `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index, generateCommentId(commentId));

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.delete(path);

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
  'DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: ['@v3', '@comments', '@delete-comment'],
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
        `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 401 Unauthorized — ${title}`,
        {
          tag: [Layer.API, '@VCS-14539', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX, dataGenerator.faker.number.int());
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.delete(path, {
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
        `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 401 Unauthorized — ${title}`,
        {
          tag: [Layer.API, '@VCS-14539', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX, dataGenerator.faker.number.int());
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.delete(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      `DELETE /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 204 No Content — Удаление комментария с вложением`,
      {
        tag: [Layer.UI, '@VCS-11580', Priority.MINOR],
      },
      async ({
        apiRegistry,
        entityManager,
        tenantInfo,
        privilegeService,
        user,
        authService,
        pageRegistry,
        fileSystemService,
        dataGenerator,
      }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const pullOverviewPage = new pageRegistry.repo.pulls.overview(page);

        await pullOverviewPage.goToEndpoint(Endpoint.REPOSITORY_PULL_REQUEST, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          index: FIRST_PULL_INDEX,
        });
        await pullOverviewPage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(tempDir, '.txt', 1024);

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        await commentForm.uploadZone.waitForUpload(absolutePath);

        const message = dataGenerator.faker.lorem.sentence();
        await commentForm.message.fill(message);
        await commentForm.submit.click();

        await pullOverviewPage.timeline.comment.expect.toHaveCount(1);

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const comments = await commentsApi.getComments(repoOptions, FIRST_PULL_INDEX);

        expect(comments.comments).toHaveLength(1);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, comments.comments[0].id);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response);
      },
    );
  },
);
