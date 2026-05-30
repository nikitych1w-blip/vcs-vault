import { PrInfoZodType, RepositoryV3ZodType, zPrInfo } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { ALL_CHARS, DataGenerator } from '@vcs-pw/services/data.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const FIRST_PULL_INDEX = 1;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/decline`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  branchName: string;
  git: GitWrapper;
  pullInfo: PrInfoZodType;
}

test.describe(
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline',
  {
    tag: [Layer.API, '@v3', '@pulls', '@decline-pull'],
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

      testContext.put({ pullInfo, repoOptions, repoInfo, branchName: pullInfo.head.name, git });
    });

    [
      {
        title: 'Сообщение отсутствует',
        generateBody: (_: DataGenerator) => {
          return {};
        },
      },
      {
        title: 'Сообщение равно пустой строке',
        generateBody: (_: DataGenerator) => {
          return { message: '' };
        },
      },
      {
        title: 'Сообщение равно 1000 символов',
        generateBody: (dg: DataGenerator) => {
          return { message: dg.faker.string.fromCharacters(ALL_CHARS, 1000) };
        },
      },
    ].forEach(({ title, generateBody }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 200 OK — Отмена PR. ${title}`,
        {
          tag: ['@VCS-9580', Priority.CRITICAL],
        },
        async ({ user, apiRegistry, dataGenerator, tenantInfo, config, testContext }) => {
          const { pullInfo, repoOptions, repoInfo, branchName, git } = testContext as unknown as ThisTestContext;

          const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const commitMessageResult = await git.getCommitMessage(branchName);
          expect(commitMessageResult).toBeOk();
          const commitMessage = commitMessageResult.result!;

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const body = generateBody(dataGenerator);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.ok(response, {
            zodSchema: zPrInfo,
            data: {
              assignees: [],
              base: {
                name: repoInfo.default_branch,
                protected: false,
                commit: {
                  hash: defaultSha,
                  title: 'Initial commit',
                  created_at: expect.stringIso(),
                },
              },
              body: pullInfo.body ?? '',
              closed_at: expect.stringIso(),
              code_owners: [],
              created_at: expect.stringIso(),
              diff_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}.diff`,
              due_date: null,
              head: {
                name: branchName,
                protected: false,
                commit: {
                  hash: branchSha,
                  title: commitMessage,
                  created_at: expect.stringIso(),
                },
              },
              html_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}`,
              index: FIRST_PULL_INDEX,
              labels: [],
              mergeable: true,
              merged_at: null,
              merged_by: null,
              merge_base: defaultSha,
              merge_commit_sha: null,
              milestone: null,
              patch_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}.patch`,
              pr_creator: user.name,
              reviewers: [],
              state: 'closed',
              title: pullInfo.title,
              updated_at: expect.stringIso(),
              url: `${config.ui.baseUrl}api/v3/repos/${tenantInfo.id}/${repoOptions.projectName}/${repoInfo.name}/pulls/${FIRST_PULL_INDEX}`,
            },
          });
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 403 Forbidden — Нет прав на отмену PR (привилегия write)',
      {
        tag: ['@VCS-9751', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    [
      {
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
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateDetailMessage: (_: RepoOptions) => `PR с таким индексом ${FIRST_PULL_INDEX * 10} не найден`,
      },
    ].forEach(({ title, generateRepoOptions, index, generateDetailMessage }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-9750', Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(fakeRepoOptions),
            instance: path,
          });
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 409 Conflict — Нельзя повторно закрыть уже закрытый PR',
      {
        tag: ['@VCS-9627', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path);

        await HttpResponseAssertions.conflict(response, {
          title: 'Неподходящий статус PR',
          detail: 'PR в статусе Merged или Declined. Такой PR нельзя отклонить',
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 409 Conflict — Нельзя закрыть слитый PR',
      {
        tag: ['@VCS-9582', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.mergePull(repoOptions, FIRST_PULL_INDEX, { merge_method: 'rebase' });

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path);

        await HttpResponseAssertions.conflict(response, {
          title: 'Неподходящий статус PR',
          detail: 'PR в статусе Merged или Declined. Такой PR нельзя отклонить',
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 400 Bad Request — Сообщение содержит больше 1000 символов',
      {
        tag: ['@VCS-9678', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, {
          message: dataGenerator.faker.string.fromCharacters(ALL_CHARS, 1001),
        });

        await HttpResponseAssertions.badRequest(response, {
          validation: [
            {
              location: 'field',
              name: 'message',
              error: 'Значение параметра message слишком длинное. Максимальная длина 1000 символов',
              code: 'invalid_message_length',
            },
          ],
          instance: path,
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 200 OK — Вызов с токеном со скоупом repo`,
      {
        tag: ['@VCS-12716', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-9748', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );
  },
);

// Не нужен beforeEach с созданием PR
test.describe(
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline',
  {
    tag: [Layer.API, '@v3', '@pulls', '@decline-pull'],
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
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/decline — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9628', Priority.CRITICAL],
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
  },
);
