import { PrInfoZodType, RepositoryV3ZodType, zPrInfo } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { getRandomElement } from '@vcs-pw/utils/object.util';

const FIRST_PULL_INDEX = 1;
const MERGE_STRATEGIES = ['merge', 'squash', 'rebase', 'rebase-merge'] as const;

const MERGE_SETTINGS_MAPPING = {
  merge: 'allow_merge_commits',
  squash: 'allow_squash_merge',
  rebase: 'allow_rebase',
  'rebase-merge': 'allow_rebase_explicit',
  'manually-merged': 'allow_manual_merge',
} as const;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/merge`;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  branchName: string;
  git: GitWrapper;
  pullInfo: PrInfoZodType;
}

test.describe(
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge',
  {
    tag: [Layer.API, '@v3', '@pulls', '@merge-pull'],
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

      testContext.put({
        pullInfo,
        repoOptions,
        repoInfo,
        branchName: pullInfo.head.name,
        git,
      });
    });

    [
      {
        tag: '@VCS-9521',
        mergeMethod: 'rebase',
      },
      { tag: '@VCS-9522', mergeMethod: 'merge' },
      { tag: '@VCS-9523', mergeMethod: 'rebase-merge' },
      { tag: '@VCS-9525', mergeMethod: 'squash' },
    ].forEach(({ tag, mergeMethod }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 200 OK — Слияние PR: ${mergeMethod}`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, testContext }) => {
          const { pullInfo, repoOptions, repoInfo, branchName, git } = testContext as unknown as ThisTestContext;

          const defaultShaResult = await git.getShaByRef(pullInfo.base.name);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const commitMessageResult = await git.getCommitMessage(branchName);
          expect(commitMessageResult).toBeOk();
          const commitMessage = commitMessageResult.result!;

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const body = { merge_method: mergeMethod };

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          const checkoutResult = await git.checkout(pullInfo.base.name);
          expect(checkoutResult).toBeOk();

          const pullResult = await git.pull();
          expect(pullResult).toBeOk();

          const mergeShaResult = await git.getShaByRef(pullInfo.base.name);
          expect(mergeShaResult).toBeOk();
          const mergeSha = mergeShaResult.result!;

          const mergeMessageResult = await git.getCommitMessage(pullInfo.base.name);
          expect(mergeMessageResult).toBeOk();
          const mergeCommitMessage = mergeMessageResult.result!;

          await HttpResponseAssertions.ok(response, {
            zodSchema: zPrInfo,
            data: {
              assignees: [],
              base: {
                name: repoInfo.default_branch,
                protected: false,
                commit: {
                  hash: mergeSha,
                  title: mergeCommitMessage,
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
              merged_at: expect.stringIso(),
              merged_by: user.name,
              merge_base: defaultSha,
              merge_commit_sha: mergeSha,
              milestone: null,
              patch_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}.patch`,
              pr_creator: user.name,
              reviewers: [],
              state: 'merged',
              title: pullInfo.title,
              updated_at: expect.stringIso(),
              url: expect.any(String),
            },
          });
        },
      );
    });

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 200 OK — Слияние PR: manually-merged`,
      {
        tag: ['@VCS-9524', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, databaseService, config, tenantInfo }) => {
        const { pullInfo, repoOptions, repoInfo, branchName, git } = testContext as unknown as ThisTestContext;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const commitMessageResult = await git.getCommitMessage(branchName);
        expect(commitMessageResult).toBeOk();
        const commitMessage = commitMessageResult.result!;

        const checkoutToDefaultBranchResult = await git.checkout(pullInfo.base.name);
        expect(checkoutToDefaultBranchResult).toBeOk();

        const mergeResult = await git.mergeNoFastForward(branchName);
        expect(mergeResult).toBeOk();

        const pushResult = await git.push();
        expect(pushResult).toBeOk();

        const mergeShaResult = await git.getShaByRef(pullInfo.base.name);
        expect(mergeShaResult).toBeOk();
        const mergeSha = mergeShaResult.result!;

        const mergeMessageResult = await git.getCommitMessage(pullInfo.base.name);
        expect(mergeMessageResult).toBeOk();
        const mergeCommitMessage = mergeMessageResult.result!;

        await databaseService.repos.pulls.waitForCommitsBehindCount(repoOptions, FIRST_PULL_INDEX, 1);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const method = 'manually-merged';
        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        await reposApi.editSettings(repoOptions, {
          [MERGE_SETTINGS_MAPPING[method]]: true,
        });

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const body = { merge_method: method, merge_commit_id: mergeSha };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zPrInfo,
          data: expect.objectContaining({
            base: {
              name: repoInfo.default_branch,
              protected: false,
              commit: {
                hash: mergeSha,
                title: mergeCommitMessage,
                created_at: expect.stringIso(),
              },
            },
            head: {
              name: branchName,
              protected: false,
              commit: {
                hash: branchSha,
                title: commitMessage,
                created_at: expect.stringIso(),
              },
            },
            merged_at: expect.stringIso(),
            merged_by: user.name,
            merge_base: branchSha,
            merge_commit_sha: mergeSha,
            state: 'merged',
            url: `${config.ui.baseUrl}api/v3/repos/${tenantInfo.id}/${repoOptions.projectName}/${repoInfo.name}/pulls/${FIRST_PULL_INDEX}`,
          }),
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нет прав на отмену PR (привилегия write)',
      {
        tag: ['@VCS-13677', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;
        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    [
      {
        tag: '@VCS-9410',
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
        tag: '@VCS-9575',
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
        tag: '@VCS-9578',
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
        tag: '@VCS-9579',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateDetailMessage: (_: RepoOptions) => `PR с таким индексом ${FIRST_PULL_INDEX * 10} не найден`,
      },
    ].forEach(({ tag, title, generateRepoOptions, index, generateDetailMessage }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, testContext, apiRegistry, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index);

          const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(fakeRepoOptions),
            instance: path,
          });
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 409 Conflict — Нельзя слить закрытый PR',
      {
        tag: ['@VCS-9562', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.conflict(response, {
          title: 'Неподходящий статус PR',
          detail: 'PR в статусе Merged или Declined. Такой PR нельзя слить',
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 409 Conflict — Нельзя повторно слить уже слитый PR',
      {
        tag: ['@VCS-13675', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.mergePull(repoOptions, FIRST_PULL_INDEX, body);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.conflict(response, {
          title: 'Неподходящий статус PR',
          detail: 'PR в статусе Merged или Declined. Такой PR нельзя слить',
          instance: path,
        });
      },
    );

    [
      {
        tag: '@VCS-9577',
        title: 'Длина поля head_commit_id превышает 40 символов',
        generateBody: (dg: DataGenerator) => {
          return { merge_method: getRandomElement(MERGE_STRATEGIES), head_commit_id: dg.faker.string.alphanumeric(41) };
        },
        validationError: {
          location: 'field',
          name: 'head_commit_id',
          code: 'invalid_head_commit_id_length',
          error: 'Некорректная длина параметра head_commit_id. Максимальная длина 40 символов',
        },
      },
      {
        tag: '@VCS-13681',
        title: 'Длина поля merge_commit_id превышает 40 символов',
        generateBody: (dg: DataGenerator) => {
          return {
            merge_method: getRandomElement(MERGE_STRATEGIES),
            merge_commit_id: dg.faker.string.alphanumeric(41),
          };
        },
        validationError: {
          location: 'field',
          name: 'merge_commit_id',
          code: 'invalid_merge_commit_ID_length',
          error: 'Некорректная длина параметра merge_commit_id. Максимальная длина 40 символов',
        },
      },
      {
        tag: '@VCS-9576',
        title: 'Длина поля message превышает 1000 символов',
        generateBody: (dg: DataGenerator) => {
          return { merge_method: getRandomElement(MERGE_STRATEGIES), message: dg.faker.string.alphanumeric(1001) };
        },
        validationError: {
          location: 'field',
          name: 'message',
          code: 'invalid_message_length',
          error: 'Некорректная длина сообщения. Максимальная длина 1000 символов',
        },
      },
      {
        tag: '@VCS-9529',
        title: 'Длина поля title превышает 255 символов',
        generateBody: (dg: DataGenerator) => {
          return { merge_method: getRandomElement(MERGE_STRATEGIES), title: dg.faker.string.alphanumeric(256) };
        },
        validationError: {
          location: 'field',
          name: 'title',
          code: 'invalid_title_length',
          error: 'Некорректная длина заголовка. Максимальная длина 255 символов',
        },
      },
      {
        tag: '@VCS-9526',
        title: 'Отсутствует обязательное поле merge_method',
        generateBody: (_: DataGenerator) => {
          return {};
        },
        validationError: {
          location: 'field',
          name: 'merge_method',
          code: 'missing_merge_method_field',
          error: 'Отсутствует обязательное поле merge_method',
        },
      },
      {
        tag: '@VCS-9527',
        title: 'Невалидный merge_method',
        generateBody: (dg: DataGenerator) => {
          return { merge_method: dg.faker.string.alphanumeric(8) };
        },
        validationError: {
          location: 'field',
          name: 'merge_method',
          error: 'Значение параметра merge_method не соответствует возможным значениям.',
          code: 'invalid_merge_method_param',
        },
      },
    ].forEach(({ tag, title, generateBody, validationError }) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 400 Bad Request — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, apiRegistry, testContext, dataGenerator }) => {
          const { repoOptions } = testContext as unknown as ThisTestContext;

          const body = generateBody(dataGenerator);

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.badRequest(response, { validation: [validationError], instance: path });

          await step('PR не был слит', async () => {
            const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
            const pullInfo = await pullsApi.getPull(repoOptions, FIRST_PULL_INDEX);
            expect(pullInfo.state).toBe('open');
          });
        },
      );
    });

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 400 Bad Request — Поле merge_commit_id обязательно при manually-merged`,
      {
        tag: ['@VCS-13836', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const method = 'manually-merged';
        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        await reposApi.editSettings(repoOptions, {
          [MERGE_SETTINGS_MAPPING[method]]: true,
        });

        const body = { merge_method: method };
        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.badRequest(response, {
          validation: [
            {
              location: 'field',
              name: 'merge_commit_id',
              error: 'Отсутствует обязательное поле merge_commit_id',
              code: 'missing_merge_commit_id_field',
            },
          ],
          instance: path,
        });

        await step('PR не был слит', async () => {
          const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          const pullInfo = await pullsApi.getPull(repoOptions, FIRST_PULL_INDEX);
          expect(pullInfo.state).toBe('open');
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 200 OK — Вызов с токеном со скоупом repo`,
      {
        tag: ['@VCS-13678', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-9569', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, testContext }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const body = { merge_method: getRandomElement(MERGE_STRATEGIES) } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 404 Not Found — Указан несуществующий head_commit_id`,
      {
        tag: ['@VCS-9574', Priority.MINOR],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
          head_commit_id: dataGenerator.faker.git.commitSha(),
        };
        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.notFound(response, {
          detail: expect.stringMatching(/Коммит с таким идентификатором .* не найден/),
          instance: path,
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 404 Not Found — Указан несуществующий merge_commit_id (только для manually-merged)`,
      {
        tag: ['@VCS-9564', Priority.MINOR],
      },
      async ({ user, apiRegistry, testContext, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        const method = 'manually-merged';
        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        await reposApi.editSettings(repoOptions, {
          [MERGE_SETTINGS_MAPPING[method]]: true,
        });

        const body = { merge_method: method, merge_commit_id: dataGenerator.faker.git.commitSha() };
        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.notFound(response, {
          detail: expect.stringMatching(/Коммит с таким идентификатором .* не найден/),
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 409 Conflict — Указан отстающий head_commit_id',
      {
        tag: ['@VCS-9563', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext }) => {
        const { repoOptions, git } = testContext as unknown as ThisTestContext;

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        const pullInfo = await pullsApi.getPull(repoOptions, FIRST_PULL_INDEX);

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
          head_commit_id: pullInfo.head.commit.hash,
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.conflict(response, {
          title: 'Не соответствует head_commit_id',
          detail: 'Не совпадает переданное значение head_commit_id с текущим значением.',
          instance: path,
        });
      },
    );

    MERGE_STRATEGIES.forEach((mergeMethod) => {
      test(
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя слить запрос на слияние при наличии конфликта (${mergeMethod})`,
        {
          tag: ['@VCS-9573', Priority.NORMAL],
        },
        async ({ user, apiRegistry, testContext, fileSystemService, databaseService }) => {
          const { repoOptions, git, repoInfo } = testContext as unknown as ThisTestContext;

          const generateCommitsResult = await git.generateCommitsAndPush(1);
          expect(generateCommitsResult).toBeOk();

          const checkoutDefaultBranch = await git.checkout(repoInfo.default_branch);
          expect(checkoutDefaultBranch).toBeOk();

          // Изменяем один из файлов, которые были добавлены в другой ветке, чтобы получить конфликт
          const fileToEdit = generateCommitsResult.result!.files[0];
          await fileSystemService.createOrOverrideFile(fileToEdit, git.dir, 'Conflict content');

          const commitsAndPushResult = await git.commitAllAndPush();
          expect(commitsAndPushResult).toBeOk();

          await databaseService.repos.pulls.waitForCommitsBehindCount(repoOptions, FIRST_PULL_INDEX, 1);
          await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

          const body = {
            merge_method: mergeMethod,
          } as const;

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, body);

          await HttpResponseAssertions.forbidden(response, {
            title: 'Слияние запрещено',
            detail: 'Слияние PR не доступно, есть конфликты или не пройдены проверки',
            instance: path,
          });
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Метод слияния отключен в настройках',
      {
        tag: ['@VCS-9568', Priority.NORMAL],
      },
      async ({ user, apiRegistry, testContext, privilegeService }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const [mergeMethod, settingName] = getRandomElement(Object.entries(MERGE_SETTINGS_MAPPING));

        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        await reposApi.editSettings(repoOptions, {
          [settingName]: false,
        });

        const body = {
          merge_method: mergeMethod,
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Метод слияния PR недоступен',
          detail: 'Метод слияния отключен в настройках',
          instance: path,
        });
      },
    );
  },
);

// Не нужен beforeEach с созданием PR
test.describe(
  'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge',
  {
    tag: [Layer.API, '@v3', '@pulls', '@merge-pull'],
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
        `POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9561', Priority.CRITICAL],
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
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя слить при отсутствии нужного количества одобрений',
      {
        tag: ['@VCS-9572', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry, userPool }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const reviewer = userPool.get();
        await privilegeService.grantToRepo(repoOptions, reviewer.name, PrivilegeGroup.WRITER);

        const reviewSettingsApi = apiRegistry.v3.repos.reviewSettings.withBasic(user);
        await reviewSettingsApi.createReviewSetting(repoOptions, {
          branch_name: '*',
          approval_settings: {
            require_default_reviewers: true,
            default_reviewers: [
              {
                default_reviewers_list: [reviewer.name],
                required_approvals_count: 1,
              },
            ],
          },
          merge_restrictions: {},
          merge_settings: {},
          status_checks: {},
        });

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Слияние без review PR недоступно',
          detail: 'Отсутствуют достаточные одобрения ревьюеров по правилу/ам * для слития PR в защищенную ветку.',
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя удалить защищенную ветку',
      {
        tag: ['@VCS-9570', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const branchProtectionsApi = apiRegistry.v3.repos.branchProtections.withBasic(user);
        await branchProtectionsApi.createBranchProtection(repoOptions, {
          branch_name: '*',
          push_settings: {},
          force_push_settings: {},
          deletion_settings: {},
          additional_restrictions: {},
        });

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
          delete_branch_after_merge: true,
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Удаление защищенной ветки недоступно',
          detail: 'Недостаточно прав на удаление ветки',
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя слить устаревший запрос на слияние',
      {
        tag: ['@VCS-9566', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry, databaseService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const reviewSettingsApi = apiRegistry.v3.repos.reviewSettings.withBasic(user);
        await reviewSettingsApi.createReviewSetting(repoOptions, {
          branch_name: '*',
          approval_settings: {
            require_default_reviewers: false,
            default_reviewers: [],
          },
          merge_restrictions: {
            block_on_outdated_branch: true,
          },
          merge_settings: {},
          status_checks: {},
        });

        const [pullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const checkoutDefaultBranch = await git.checkout(pullInfo.base.name);
        expect(checkoutDefaultBranch).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        await databaseService.repos.pulls.waitForCommitsBehindCount(repoOptions, FIRST_PULL_INDEX, 1);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Слияние устаревшего PR недоступно',
          detail: "PR устарел и включена проверка 'блокировать если устарел'",
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя слить при запрошенных изменениях',
      {
        tag: ['@VCS-9565', Priority.NORMAL],
      },
      async ({
        tenantInfo,
        entityManager,
        privilegeService,
        user,
        apiRegistry,
        userPool,
        authService,
        dataGenerator,
        databaseService,
      }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const reviewer = userPool.get();
        await privilegeService.grantToRepo(repoOptions, reviewer.name, PrivilegeGroup.WRITER);

        const reviewSettingsApi = apiRegistry.v3.repos.reviewSettings.withBasic(user);
        await reviewSettingsApi.createReviewSetting(repoOptions, {
          branch_name: '*',
          approval_settings: {
            require_default_reviewers: true,
            default_reviewers: [
              {
                default_reviewers_list: [reviewer.name],
                required_approvals_count: 0,
              },
            ],
          },
          merge_restrictions: {
            block_on_rejected_reviews: true,
          },
          merge_settings: {},
          status_checks: {},
        });

        const [pullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const branchShaResult = await git.getShaByRef(pullInfo.head.name);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const reviewerContext = await authService.createAuthenticatedSession(reviewer);
        const reviewsApi = apiRegistry.web.v1.repo.reviews.withRequest(reviewerContext.request);
        await reviewsApi.createRejectReview(repoOptions, FIRST_PULL_INDEX, {
          commit_id: branchSha,
          content: dataGenerator.faker.lorem.sentence(),
        });

        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Слияние PR с запросами review недоступно',
          detail:
            "У PR есть запросы на рассмотрение и включена проверка 'блокировать при наличии запросов на рассмотрение'",
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:project/:repo/pulls/:index/merge — 403 Forbidden — Нельзя слить при отсутствии одобрения от владельцев кода',
      {
        tag: ['@VCS-9571', Priority.NORMAL],
      },
      async ({ tenantInfo, entityManager, privilegeService, user, apiRegistry, userPool, authService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const codeOwner = userPool.get();
        await privilegeService.grantToRepo(repoOptions, codeOwner.name, PrivilegeGroup.WRITER);

        const fileApi = apiRegistry.v3.repos.contents.file.withBasic(codeOwner);
        await fileApi.createCodeOwnersFile(repoOptions, repoInfo.default_branch, { '*': [codeOwner.name] });

        const context = await authService.createAuthenticatedSession(user);
        const repoSettingsApi = apiRegistry.web.v1.repo.settings.withRequest(context.request);
        await repoSettingsApi.applyCodeOwnersSettings(repoOptions, { enabled: true, approvalCount: 1 });

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const body = {
          merge_method: getRandomElement(MERGE_STRATEGIES),
        } as const;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, body);

        await HttpResponseAssertions.forbidden(response, {
          title: 'Слияние PR без одобрения codeowners',
          detail: 'Требуется одобрения codeowners для слития PR в защищенную ветку.',
          instance: path,
        });
      },
    );
  },
);
