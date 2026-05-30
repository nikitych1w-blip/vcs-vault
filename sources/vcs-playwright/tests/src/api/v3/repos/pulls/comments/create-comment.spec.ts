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
const README_PATH = 'README.md';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/comments`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  branchSha: string;
  git: GitWrapper;
  pullInfo: PrInfoZodType;
}

/**
 * Тип определяется автоматически по наличию полей:
 * Если передан type — создаётся ревью (ReviewComment).
 * Если передан хотя бы один из file_variant, filepath, line — создаётся комментарий к коду (CodeComment).
 * Иначе — создаётся простой комментарий (SimpleComment).
 */
test.describe(
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments',
  {
    tag: [Layer.API, '@v3', '@comments', '@create-comment'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach('Создание PR', async ({ tenantInfo, entityManager, privilegeService, user, testContext }) => {
      const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
      const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

      const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
      const repoOptions = { ...projectOptions, repoName: repoInfo.name };

      await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

      const [pullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

      const branchShaResult = await git.getShaByRef(pullInfo.head.name);
      expect(branchShaResult).toBeOk();
      const branchSha = branchShaResult.result!;

      testContext.put({
        pullInfo,
        repoOptions,
        repoInfo,
        branchSha,
        git,
      });
    });

    [
      {
        tag: '@VCS-12507',
        privilegeGroup: PrivilegeGroup.WRITER,
      },
      {
        tag: '@VCS-12515',
        privilegeGroup: PrivilegeGroup.READ_APPROVE,
      },
      {
        tag: '@VCS-12516',
        privilegeGroup: PrivilegeGroup.READ_CREATE,
      },
      {
        tag: '@VCS-14124',
        privilegeGroup: PrivilegeGroup.READ_MERGE,
      },
    ].forEach(({ tag, privilegeGroup }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Создание простого комментария (группа привилегий ${privilegeGroup})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator, privilegeService }) => {
          const { repoOptions, repoInfo } = testContext as unknown as ThisTestContext;

          await privilegeService.grantToRepo(repoOptions, user.name, privilegeGroup);

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const body = { body: dataGenerator.faker.lorem.paragraphs() };

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.created(response, {
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
              id: expect.any(Number),
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
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-14273', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Успешный вызов с помощью токена со скоупом repo`,
      {
        tag: ['@VCS-14274', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response);
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Создание комментария к коду`,
      {
        tag: ['@VCS-12932', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = {
          body: dataGenerator.faker.lorem.paragraphs(),
          line: 1,
          filepath: README_PATH,
          file_variant: 'PREVIOUS',
        };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
          data: expect.objectContaining({
            author: {
              email: user.email,
              name: user.name,
            },
            body: body.body,
            context: {
              pull_request: FIRST_PULL_INDEX,
            },
            created_at: expect.stringIso(),
            id: expect.any(Number),
            invalidated: false,
            official: false,
            review_id: expect.any(Number),
            type: 'COMMENTED',
          }),
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Создание комментария к коду с commit_sha`,
      {
        tag: ['@VCS-12931', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions, branchSha } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = {
          body: dataGenerator.faker.lorem.paragraphs(),
          line: 1,
          filepath: README_PATH,
          file_variant: 'PREVIOUS',
          commit_sha: branchSha,
        };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
        });
      },
    );

    [
      {
        tag: '@VCS-14138',
        type: 'REQUEST_CHANGES',
      },
      {
        tag: '@VCS-14139',
        type: 'APPROVED',
      },
    ].forEach(({ tag, type }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Создание ревью-комментария (${type})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const body = { body: dataGenerator.faker.lorem.paragraphs(), type };

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.created(response, {
            zodSchema: zComment,
            data: expect.objectContaining({
              invalidated: false,
              official: false,
              review_id: expect.any(Number),
              type,
            }),
          });
        },
      );
    });

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Цитирование простого комментария`,
      {
        tag: ['@VCS-12504', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const comment = await commentsApi.createComment(repoOptions, FIRST_PULL_INDEX, {
          body: dataGenerator.faker.lorem.word(),
        });

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { body: dataGenerator.faker.lorem.paragraphs(), reply_to: comment.id };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
          data: expect.objectContaining({
            body: `> ${comment.body} \n\n ${body.body}`,
          }),
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Добавление нового комментария кода к уже существующему`,
      {
        tag: ['@VCS-14144', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const commentsApi = apiRegistry.v3.repos.pulls.comments.withBasic(user);
        const comment = await commentsApi.createComment(repoOptions, FIRST_PULL_INDEX, {
          body: dataGenerator.faker.lorem.word(),
          filepath: README_PATH,
          line: 1,
          file_variant: 'PREVIOUS',
        });

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = {
          body: dataGenerator.faker.lorem.paragraphs(),
          review_id: comment.review_id,
          filepath: README_PATH,
          line: 1,
          file_variant: 'PREVIOUS',
        };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
          data: expect.objectContaining({
            body: body.body,
            review_id: comment.review_id,
          }),
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Создание простого комментария с commit_sha`,
      {
        tag: ['@VCS-12501', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions, branchSha } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { body: dataGenerator.faker.lorem.paragraphs(), commit_sha: branchSha };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Оставлен комментарий к неактуальному коммиту`,
      {
        tag: ['@VCS-14241', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator, databaseService }) => {
        const { repoOptions, branchSha, git } = testContext as unknown as ThisTestContext;

        await git.generateCommitsAndPush(1);
        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, 1, 2);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { body: dataGenerator.faker.lorem.paragraphs(), commit_sha: branchSha };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
          data: expect.objectContaining({
            invalidated: true,
            official: false,
          }),
        });
      },
    );

    [
      {
        tag: '@VCS-12505',
        title: 'Передано пустое тело комментария',
        generateBody: (_: DataGenerator) => {
          return { body: '' };
        },
        detail: 'body: required',
      },
      {
        tag: '@VCS-12936',
        title: 'Недопустимое значение file_variant',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            filepath: dg.faker.system.directoryPath(),
            line: 1,
            file_variant: dg.faker.lorem.word(),
          };
        },
        detail: "file_variant: Допускаются значения: 'PREVIOUS', 'PROPOSED'",
      },
      {
        tag: '@VCS-14237',
        title: 'Недопустимое значение type',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            type: dg.faker.lorem.word(),
          };
        },
        detail: "type: Допускаются значения: 'REQUEST_CHANGES', 'APPROVED'",
      },
      {
        tag: '@VCS-14140',
        title: 'Нулевое значение line',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            filepath: README_PATH,
            line: 0,
            file_variant: 'PREVIOUS',
          };
        },
        detail: 'line: Допускаются только натуральные значения',
      },
      {
        tag: '@VCS-14141',
        title: 'Дробное значение line',
        generateBody: (_: DataGenerator) => {
          return {
            line: 0.5,
          };
        },
        detail: 'invalid JSON',
      },
      {
        tag: '@VCS-14142',
        title: 'Не передано поле filepath для комментария к коду',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            line: 0,
            file_variant: 'PREVIOUS',
          };
        },
        detail: 'filepath: required',
      },
      {
        tag: '@VCS-14143',
        title: 'Не передано поле file_variant для комментария к коду',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            filepath: README_PATH,
            line: 1,
          };
        },
        detail: 'file_variant: required',
      },
      {
        tag: '@VCS-14145',
        title: 'commit_sha должен быть длиной ровно 40 символов',
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            commit_sha: dg.faker.git.commitSha({ length: 39 }),
          };
        },
        detail: 'commit_sha: length must be 40',
      },
    ].forEach(({ tag, title, generateBody, detail }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 400 Bad Request — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const body = generateBody(dataGenerator);

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

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
        tag: '@VCS-12509',
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: dg.uuid(),
            projectName: repoOptions.repoName,
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return { body: dg.faker.lorem.paragraphs() };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-12510',
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: dg.faker.string.ulid(),
            repoName: repoOptions.repoName,
          };
        },
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return { body: dg.faker.lorem.paragraphs() };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        tag: '@VCS-12511',
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: repoOptions.projectName,
            repoName: dg.faker.string.ulid(),
          };
        },
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return { body: dg.faker.lorem.paragraphs() };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
      {
        tag: '@VCS-12512',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateBody: (dg: DataGenerator) => {
          return { body: dg.faker.lorem.paragraphs() };
        },
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
      {
        tag: '@VCS-12933',
        title: 'Передан несуществующий commit_sha',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return { body: dg.faker.lorem.paragraphs(), commit_sha: dg.faker.git.commitSha() };
        },
        generateDetailMessage: (_: RepoOptions) => expect.stringMatching(/Коммит с таким SHA [a-z0-9]{40} не найден/),
      },
      {
        tag: '@VCS-12935',
        title: 'Передан несуществующий filepath',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            filepath: dg.faker.system.directoryPath(),
            line: 1,
            file_variant: 'PREVIOUS',
          };
        },
        generateDetailMessage: (_: RepoOptions) =>
          expect.stringMatching(/Файл validate file: get commit tree entry: .* не найден/),
      },
      {
        tag: '@VCS-12934',
        title: 'Передана несуществующая строчка кода',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        generateBody: (dg: DataGenerator) => {
          return {
            body: dg.faker.lorem.paragraphs(),
            filepath: README_PATH,
            line: 100,
            file_variant: 'PREVIOUS',
          };
        },
        generateDetailMessage: (_: RepoOptions) => 'Ресурс validate file: README.md:100 не найден',
      },
    ].forEach(({ tag, title, generateRepoOptions, generateBody, index, generateDetailMessage }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index);
          const body = generateBody(dataGenerator);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

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
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments',
  {
    tag: [Layer.API, '@v3', '@comments', '@create-comment'],
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
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12508', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.post(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 403 Forbidden — Нет прав на создание комментария',
      {
        tag: ['@VCS-12514', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { body: dataGenerator.faker.lorem.paragraphs() };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/comments — 201 Created — Оставлен ревью-комментарий от владельца кода`,
      {
        tag: ['@VCS-14250', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry, userPool, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const codeOwner = userPool.get();
        await privilegeService.grantToRepo(repoOptions, codeOwner.name, PrivilegeGroup.WRITER);

        const fileApi = apiRegistry.v3.repos.contents.file.withBasic(codeOwner);
        await fileApi.createCodeOwnersFile(repoOptions, repoInfo.default_branch, { '*': [codeOwner.name] });

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { body: dataGenerator.faker.lorem.paragraphs(), type: 'APPROVED' };

        const apiClient = apiRegistry.client.withBasic(codeOwner);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.created(response, {
          zodSchema: zComment,
          data: expect.objectContaining({
            invalidated: false,
            official: true,
          }),
        });
      },
    );
  },
);
