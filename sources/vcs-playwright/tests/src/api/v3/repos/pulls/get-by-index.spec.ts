import { zPrInfo } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { format } from 'date-fns';

const FIRST_PULL_INDEX = 1;
const DUE_DATE_FORMAT = 'dd.MM.yyyy';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}`;

test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index',
  {
    tag: [Layer.API, '@v3', '@pulls', '@get-pull'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Получение PR по индексу`,
      {
        tag: ['@VCS-9426', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, tenantInfo, config, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const [pullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const branchShaResult = await git.getShaByRef(pullInfo.head.name);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const commitMessageResult = await git.getCommitMessage(pullInfo.head.name);
        expect(commitMessageResult).toBeOk();
        const commitMessage = commitMessageResult.result!;

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

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
            closed_at: null,
            code_owners: [],
            created_at: expect.stringIso(),
            diff_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}.diff`,
            due_date: null,
            head: {
              name: pullInfo.head.name,
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
            state: 'open',
            title: pullInfo.title,
            updated_at: expect.stringIso(),
            url: `${config.ui.baseUrl}api/v3/repos/${tenantInfo.id}/${repoOptions.projectName}/${repoInfo.name}/pulls/${FIRST_PULL_INDEX}`,
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Информация о PR содержит данные по ревьюерам, владельцам кода и защите веток`,
      {
        tag: ['@VCS-12965', Priority.NORMAL],
        annotation: [
          Annotation.DESCRIPTION(
            `Относительно VCS-9426 проверяются данные по: 
            1. Ревьюерам
            2. Назначенным
            3. Владельцам кода
            4. Защите веток
            5. Меткам
            6. Этапу
            7. Due_date`,
          ),
        ],
      },
      async ({ userPool, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const user = userPool.get();
        const secondUser = userPool.get();
        const thirdUser = userPool.get();
        const fourthUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);
        await privilegeService.grantToRepo(repoOptions, secondUser.name, PrivilegeGroup.WRITER);
        await privilegeService.grantToRepo(repoOptions, thirdUser.name, PrivilegeGroup.WRITER);
        await privilegeService.grantToRepo(repoOptions, fourthUser.name, PrivilegeGroup.WRITER);

        const defaultReviewers = [fourthUser, thirdUser].map((user) => user.name);
        const codeOwners = [secondUser, thirdUser].map((user) => user.name);
        const reviewers = [secondUser, thirdUser, fourthUser].map((user) => user.name);

        const fileApi = apiRegistry.v3.repos.contents.file.withBasic(user);
        await fileApi.createCodeOwnersFile(repoOptions, repoInfo.default_branch, { '*': [...codeOwners, user.name] });

        const reviewSettingsApi = apiRegistry.v3.repos.reviewSettings.withBasic(user);
        await reviewSettingsApi.createReviewSetting(repoOptions, {
          branch_name: '*',
          approval_settings: {
            require_default_reviewers: true,
            default_reviewers: [
              {
                default_reviewers_list: defaultReviewers,
                required_approvals_count: 1,
              },
            ],
          },
          merge_restrictions: {},
          merge_settings: {},
          status_checks: {},
        });

        const branchProtectionsApi = apiRegistry.v3.repos.branchProtections.withBasic(user);
        await branchProtectionsApi.createBranchProtection(repoOptions, {
          branch_name: '*',
          push_settings: {},
          force_push_settings: {},
          deletion_settings: {},
          additional_restrictions: {},
        });
        await branchProtectionsApi.createBranchProtection(repoOptions, {
          branch_name: repoInfo.default_branch,
          push_settings: {
            require_push_whitelist: true,
            push_whitelist_usernames: [user.name],
          },
          force_push_settings: {},
          deletion_settings: {},
          additional_restrictions: {},
        });

        const milestonesApi = apiRegistry.v1.repos.milestones.withBasic(user);
        const milestoneInfo = await milestonesApi.createMilestone(repoOptions, {
          title: dataGenerator.faker.lorem.word(),
        });

        const labelsApi = apiRegistry.v1.repos.labels.withBasic(user);
        const labelInfo = await labelsApi.createLabel(repoOptions, {
          name: dataGenerator.faker.lorem.word(),
          color: dataGenerator.faker.color.rgb(),
        });

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
          due_date: format(new Date(), DUE_DATE_FORMAT),
          assignees: [secondUser.name],
          milestone: Number(milestoneInfo.id),
          labels: [Number(labelInfo.id)],
        });
        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        const pullInfo = await pullsApi.createPull(repoOptions, pullOptions);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zPrInfo,
          data: expect.objectContaining({
            assignees: pullOptions.assignees,
            base: expect.objectContaining({
              name: repoInfo.default_branch,
              protected: true,
              protection_rules: expect.arrayEqualsInAnyOrder(['*', repoInfo.default_branch]),
            }),
            code_owners: expect.arrayContaining(codeOwners.map((username) => expect.objectContaining({ username }))),
            due_date: expect.stringIso(),
            head: expect.objectContaining({
              name: pullInfo.head.name,
              protected: true,
              protection_rules: ['*'],
            }),
            labels: [
              {
                id: String(labelInfo.id),
              },
            ],
            milestone: pullOptions.milestone,
            reviewers: expect.arrayContaining(reviewers.map((username) => expect.objectContaining({ username }))),
          }),
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Получение PR с конфликтом`,
      {
        tag: ['@VCS-9433', Priority.NORMAL],
      },
      async ({
        user,
        apiRegistry,
        tenantInfo,
        gitService,
        dataGenerator,
        entityManager,
        privilegeService,
        fileSystemService,
        databaseService,
      }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, 1);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const checkoutDefaultBranch = await git.checkout(repoInfo.default_branch);
        expect(checkoutDefaultBranch).toBeOk();

        // Изменяем один из файлов, которые были добавлены в другой ветке, чтобы получить конфликт
        const fileToEdit = generateCommitsResult.result!.files[0];
        await fileSystemService.createOrOverrideFile(fileToEdit, git.dir, 'Conflict content');

        const commitsAndPushResult = await git.commitAllAndPush();
        expect(commitsAndPushResult).toBeOk();

        await databaseService.repos.pulls.waitForCommitsBehindCount(repoOptions, FIRST_PULL_INDEX, 1);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zPrInfo,
          data: expect.objectContaining({
            mergeable: false,
          }),
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 403 Forbidden — Нет прав на получение PR (привилегия read)',
      {
        tag: ['@VCS-9439', Priority.CRITICAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true, private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        await privilegeService.revokeFromRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Получение PR по индексу в публичном репозитории',
      {
        tag: ['@VCS-9438', Priority.NORMAL],
      },
      async ({ userPool, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true, private: false });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const firstUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, firstUser.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, firstUser);

        const secondUser = userPool.get();
        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(secondUser);
        const response = await apiClient.get(path);

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
        generateDetailMessage: (_: RepoOptions) => `PR с таким index ${FIRST_PULL_INDEX * 10} не найден`,
      },
    ].forEach(({ title, generateRepoOptions, index, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-9441', Priority.NORMAL],
        },
        async ({ user, entityManager, tenantInfo, privilegeService, apiRegistry, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

          await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

          const fakeRepoOptions = generateRepoOptions(repoOptions, dataGenerator);
          const path = toPath(fakeRepoOptions, index);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(fakeRepoOptions),
            instance: path,
          });
        },
      );
    });

    test(
      'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Получение закрытого PR',
      {
        tag: ['@VCS-9435', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            state: 'closed',
            merged_at: null,
            closed_at: expect.stringIso(),
          }),
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Получение слитого PR',
      {
        tag: ['@VCS-9436', Priority.NORMAL],
      },
      async ({ userPool, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const firstUser = userPool.get();
        const secondUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, firstUser.name, PrivilegeGroup.WRITER);
        await privilegeService.grantToRepo(repoOptions, secondUser.name, PrivilegeGroup.WRITER);
        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, firstUser);

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(secondUser);
        await pullsApi.mergePull(repoOptions, FIRST_PULL_INDEX, { merge_method: 'merge' });

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(secondUser);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: expect.objectContaining({
            state: 'merged',
            merged_at: expect.stringIso(),
            closed_at: expect.stringIso(),
            merged_by: secondUser.name,
            pr_creator: firstUser.name,
            merge_commit_sha: expect.any(String),
          }),
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 200 OK — Вызов с токеном со скоупом repo`,
      {
        tag: ['@VCS-9434', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-9419', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    [
      {
        title: 'Передан отрицательный индекс',
        index: -1,
        validationError: {
          location: 'param',
          name: 'index',
          error: 'Некорректный индекс PR. Индекс должен быть положительным числом',
          code: 'invalid_pr_index',
        },
      },
      {
        title: 'Передан дробный индекс',
        index: 0.5,
        validationError: {
          location: 'param',
          name: 'index',
          error: 'Некорректный индекс PR. Индекс должен быть положительным числом',
          code: 'invalid_pr_index',
        },
      },
    ].forEach(({ title, index, validationError }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-9427', Priority.NORMAL],
        },
        async ({ user, entityManager, tenantInfo, apiRegistry, privilegeService }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions);
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions, index);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.badRequest(response, { validation: [validationError], instance: path });
        },
      );
    });

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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9440', Priority.CRITICAL],
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9440', Priority.CRITICAL],
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
