import { PrInfoZodType, RepositoryV3ZodType, zComment } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
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
  git: GitWrapper;
  pullInfo: PrInfoZodType;
}

test.describe(
  'PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: [Layer.API, '@v3', '@comments', '@edit-comment'],
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
        tag: '@VCS-12469',
        privilegeGroup: PrivilegeGroup.WRITER,
        generateBody: (dg: DataGenerator) => dg.faker.string.alphanumeric(1),
      },
      {
        tag: '@VCS-12494',
        privilegeGroup: PrivilegeGroup.READ_APPROVE,
        generateBody: (dg: DataGenerator) => dg.faker.string.alphanumeric(3000),
      },
      {
        tag: '@VCS-12493',
        privilegeGroup: PrivilegeGroup.READ_CREATE,
        generateBody: (dg: DataGenerator) => dg.faker.lorem.paragraphs(),
      },
      {
        tag: '@VCS-12473',
        privilegeGroup: PrivilegeGroup.READ_MERGE,
        generateBody: (dg: DataGenerator) => dg.faker.lorem.paragraphs(),
      },
    ].forEach(({ tag, privilegeGroup, generateBody }) => {
      test(
        `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 200 OK — Редактирование комментария (группа привилегий ${privilegeGroup})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator, privilegeService }) => {
          const { repoOptions, repoInfo, commentId } = testContext as unknown as ThisTestContext;

          await privilegeService.grantToRepo(repoOptions, user.name, privilegeGroup);

          const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
          const body = { body: generateBody(dataGenerator) };

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.patch(path, body);

          await HttpResponseAssertions.ok(response, {
            zodSchema: zComment,
            data: {
              anchor_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}#issuecomment-${response.data.id}`,
              author: {
                email: user.email,
                name: user.name,
              },
              body: body.body,
              context: {
                pull_request: FIRST_PULL_INDEX,
              },
              created_at: expect.stringIso(),
              id: commentId,
              invalidated: false,
              official: false,
              review_id: 0,
              type: 'COMMENTED',
              updated_at: expect.stringIso(),
            },
          });
        },
      );
    });

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-14762', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext, dataGenerator }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 200 OK — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-14763', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext, dataGenerator }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нельзя изменить собственный комментарий при отсутствии привилегий`,
      {
        tag: ['@VCS-12492', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, privilegeService, dataGenerator }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Нельзя изменить комментарий другого пользователя даже при наличии привилегии manage_comments`,
      {
        tag: ['@VCS-12498', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, privilegeService, userPool, dataGenerator }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const otherUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, otherUser.name, PrivilegeGroup.MANAGER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const apiClient = apiRegistry.client.withBasic(otherUser);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.forbidden(response, {
          detail: `Недостаточно прав для взаимодействия с комментарием ${commentId}`,
          instance: path,
        });
      },
    );

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 200 OK — Изменение комментария с ответами`,
      {
        tag: ['@VCS-14764', Priority.NORMAL],
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
        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 403 Forbidden — Запрещено изменение комментария в архивном репозитории`,
      {
        tag: ['@VCS-12491', Priority.NORMAL],
      },
      async ({ apiRegistry, testContext, user, dataGenerator }) => {
        const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        await reposApi.editSettings(repoOptions, {
          archived: true,
        });

        const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.patch(path, body);

        await HttpResponseAssertions.forbidden(response, {
          detail: 'Добавление комметария к архивному репозиторию недопустимо',
          instance: path,
        });
      },
    );

    [
      {
        tag: '@VCS-12476',
        title: 'Передано пустое тело комментария',
        generateBody: (_: DataGenerator) => {
          return { body: '' };
        },
        detail: 'body: min length 1',
      },
    ].forEach(({ tag, title, generateBody, detail }) => {
      test(
        `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 400 Bad Request — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator }) => {
          const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

          const body = generateBody(dataGenerator);

          const path = toPath(repoOptions, FIRST_PULL_INDEX, commentId);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.patch(path, body);

          await HttpResponseAssertions.badRequest(response, {
            title: 'Некорректный запрос',
            detail,
            instance: path,
          });
        },
      );
    });

    [
      {
        tag: '@VCS-12472',
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
        tag: '@VCS-12477',
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
        tag: '@VCS-12478',
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
        tag: '@VCS-12479',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateCommentId: (id: bigint) => id,
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
      {
        tag: '@VCS-12489',
        title: 'Передан несуществующий commentId',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateCommentId: (id: bigint) => BigInt(id) * 10n,
        generateDetailMessage: (_: RepoOptions) => expect.stringMatching(/Комментарий с таким index \d+ не найден/),
      },
    ].forEach(({ tag, title, generateRepoOptions, index, generateCommentId, generateDetailMessage }) => {
      test(
        `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions, commentId } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index, generateCommentId(commentId));
          const body = { body: dataGenerator.faker.lorem.paragraphs() };

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.patch(path, body);

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
  'PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId',
  {
    tag: [Layer.API, '@v3', '@comments', '@edit-comment'],
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
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `PATCH /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments/:commentId — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12480', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX, dataGenerator.faker.number.int());
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.patch(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });
  },
);
