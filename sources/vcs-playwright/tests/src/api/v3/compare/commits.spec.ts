import { zCompareCommitsResponse } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/compare/commits`;

const MIN_PAGINATION_LIMIT = 10;

const createAndPushTag = async (git: GitWrapper, dg: DataGenerator, branch: string): Promise<string> => {
  const tagName = `v${dg.faker.string.alphanumeric(5)}`;

  const addTagResult = await git.addTag(tagName, branch);
  expect(addTagResult).toBeOk();

  const pushTagsResult = await git.pushTags();
  expect(pushTagsResult).toBeOk();

  return tagName;
};

const REF_COMBINATIONS = [
  {
    title: 'ветки и ветки',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
  },
  {
    title: 'ветки и тега',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
  },
  {
    title: 'ветки и SHA',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
  },
  {
    title: 'тега и ветки',
    fromValueSupplier: (git: GitWrapper, dg: DataGenerator, branch: string, _sha: string): Promise<string> =>
      createAndPushTag(git, dg, branch),
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
  },
  {
    title: 'тега и тега',
    fromValueSupplier: (git: GitWrapper, dg: DataGenerator, branch: string, _sha: string): Promise<string> =>
      createAndPushTag(git, dg, branch),
    toValueSupplier: (git: GitWrapper, dg: DataGenerator, branch: string, _sha: string): Promise<string> =>
      createAndPushTag(git, dg, branch),
  },
  {
    title: 'тега и SHA',
    fromValueSupplier: (git: GitWrapper, dg: DataGenerator, branch: string, _sha: string): Promise<string> =>
      createAndPushTag(git, dg, branch),
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
  },
  {
    title: 'SHA и ветки',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, branch: string, _sha: string): string => branch,
  },
  {
    title: 'SHA и тега',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
    toValueSupplier: (git: GitWrapper, dg: DataGenerator, branch: string, _sha: string): Promise<string> =>
      createAndPushTag(git, dg, branch),
  },
  {
    title: 'SHA и SHA',
    fromValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
    toValueSupplier: (_git: GitWrapper, _dg: DataGenerator, _branch: string, sha: string): string => sha,
  },
] as const;

test.describe(
  'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits',
  {
    tag: [Layer.API, '@v3', '@compare-commits'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    REF_COMBINATIONS.forEach(({ title, fromValueSupplier, toValueSupplier }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Сравнение ${title} (ahead)`,
        {
          tag: ['@VCS-10669', Priority.CRITICAL],
          annotation: [Annotation.DESCRIPTION('Доступ по ролевой: read')],
        },
        async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

          const git = await gitService.getConfiguredGit(user);
          const cloneResult = await git.clone(repoInfo.links.clone);
          expect(cloneResult).toBeOk();

          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const defaultPushResult = await git.generateFilesAndPushAll(1);
            expect(defaultPushResult).toBeOk();
          });

          const branchName = dataGenerator.gitBranch();
          const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
          expect(checkoutBranchResult).toBeOk();

          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const newBranchPushResult = await git.generateFilesAndPushAll(1);
            expect(newBranchPushResult).toBeOk();
          });

          const commitMessageResult = await git.getCommitMessage(branchName);
          expect(commitMessageResult).toBeOk();
          const commitMessage = commitMessageResult.result!;

          const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const fromValue = await Promise.resolve(
            fromValueSupplier(git, dataGenerator, repoInfo.default_branch, defaultSha),
          );
          const toValue = await Promise.resolve(toValueSupplier(git, dataGenerator, branchName, branchSha));

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, {
            params: {
              from: fromValue,
              to: toValue,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: expect.objectContaining({
              data: [
                {
                  author: {
                    name: user.name,
                    email: user.email,
                    date: expect.stringIso(),
                  },
                  committer: {
                    name: user.name,
                    email: user.email,
                    date: expect.stringIso(),
                  },
                  created: expect.stringIso(),
                  parents: [
                    {
                      created: expect.stringIso(),
                      sha: defaultSha,
                      url: expect.stringMatching(defaultSha),
                    },
                  ],
                  sha: branchSha,
                  message: expect.stringContaining(commitMessage),
                  url: expect.stringMatching(`git/commits/${branchSha}`),
                  html_url: expect.stringMatching(`commit/${branchSha}`),
                  tree: expect.objectContaining({
                    created: expect.stringIso(),
                    sha: branchSha,
                    url: expect.stringMatching(`git/trees/${branchSha}`),
                  }),
                },
              ],
              diffInfo: {
                base_commit: defaultSha,
                merge_base_commit: defaultSha,
                head_commit: branchSha,
                total_commits: 1,
                total_files: 1,
                status: 'ahead',
              },
            }),
          });
        },
      );
    });

    [
      {
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (
          _: { id: string },
          projectInfo: { name: string },
          repoInfo: { name: string },
          dg: DataGenerator,
        ) => {
          return {
            tenantId: dg.uuid(),
            projectName: projectInfo.name,
            repoName: repoInfo.name,
          };
        },
        generateDetailMessage: (_: RepoOptions) => 'Тенант с таким UUID не найден',
      },
      {
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (
          tenantInfo: { id: string },
          _: { name: string },
          repoInfo: { name: string },
          dg: DataGenerator,
        ) => {
          return {
            tenantId: tenantInfo.id,
            projectName: dg.faker.string.ulid(),
            repoName: repoInfo.name,
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (
          tenantInfo: { id: string },
          projectInfo: { name: string },
          _: { name: string },
          dg: DataGenerator,
        ) => {
          return {
            tenantId: tenantInfo.id,
            projectName: projectInfo.name,
            repoName: dg.faker.string.ulid(),
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
    ].forEach(({ title, generateRepoOptions, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-10670', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
            default_branch: 'main',
          });

          const repoOptions = generateRepoOptions(tenantInfo, projectInfo, repoInfo, dataGenerator);
          const path = toPath(repoOptions);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(repoOptions),
            instance: path,
          });
        },
      );
    });

    [
      {
        title: 'Параметр from указывает на несуществующую ветку',
        paramName: 'from',
        paramValue: 'non-existent-branch',
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
      {
        title: 'Параметр from указывает на несуществующий тег',
        paramName: 'from',
        paramValue: 'v99.99.99',
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
      {
        title: 'Параметр from указывает на несуществующий SHA',
        paramName: 'from',
        paramValue: 'a'.repeat(40),
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
      {
        title: 'Параметр to указывает на несуществующую ветку',
        paramName: 'to',
        paramValue: 'non-existent-branch',
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
      {
        title: 'Параметр to указывает на несуществующий тег',
        paramName: 'to',
        paramValue: 'v99.99.99',
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
      {
        title: 'Параметр to указывает на несуществующий SHA',
        paramName: 'to',
        paramValue: 'b'.repeat(40),
        otherParamValue: 'main',
        generateDetailMessage: () => 'Ресурс {from/to} не найден',
      },
    ].forEach(({ title, paramName, paramValue, otherParamValue, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-10671', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
            default_branch: 'main',
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, {
            params: {
              from: paramName === 'from' ? paramValue : otherParamValue,
              to: paramName === 'to' ? paramValue : otherParamValue,
            },
          });

          await HttpResponseAssertions.notFound(response, { detail: generateDetailMessage(), instance: path });
        },
      );
    });

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo',
      {
        tag: ['@VCS-10672', Priority.NORMAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);

        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    [
      {
        title: 'Параметр from содержит более 40 символов',
        params: {
          from: 'a'.repeat(41),
          to: 'main',
          page: undefined,
          limit: undefined,
        },
        validationError: {
          location: 'param',
          name: 'from',
          error: 'Некорректно указан параметр запроса from. Допустимая длина от 1 до 40 символов',
          code: 'invalid_query_param_from',
        },
      },
      {
        title: 'Параметр to содержит более 40 символов',
        params: {
          from: 'main',
          to: 'b'.repeat(41),
          page: undefined,
          limit: undefined,
        },
        validationError: {
          location: 'param',
          name: 'to',
          error: 'Некорректно указан параметр запроса to. Допустимая длина от 1 до 40 символов',
          code: 'invalid_query_param_to',
        },
      },
      {
        title: 'Параметр limit меньше минимального значения',
        params: {
          from: 'main',
          to: 'main',
          page: undefined,
          limit: 9,
        },
        validationError: {
          location: 'param',
          name: 'limit',
          error: 'Некорректно указан параметр запроса limit. Допустимое значение, целое натуральное число от 10 до 100',
          code: 'invalid_query_param_limit',
        },
      },
      {
        title: 'Параметр limit больше максимального значения',
        params: {
          from: 'main',
          to: 'main',
          page: undefined,
          limit: 101,
        },
        validationError: {
          location: 'param',
          name: 'limit',
          error: 'Некорректно указан параметр запроса limit. Допустимое значение, целое натуральное число от 10 до 100',
          code: 'invalid_query_param_limit',
        },
      },
      {
        title: 'Параметр page меньше 1',
        params: {
          from: 'main',
          to: 'main',
          page: 0,
          limit: undefined,
        },
        validationError: {
          location: 'param',
          name: 'page',
          error: 'Некорректно указан параметр запроса page. Допустимое значение, целое натуральное число',
          code: 'invalid_query_param_page',
        },
      },
    ].forEach(({ title, params, validationError }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-10673', Priority.MINOR],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, { params });
          await HttpResponseAssertions.badRequest(response, {
            validation: [validationError],
            instance: expect.stringContaining(path),
          });
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
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-10674', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 409 Conflict — Нет общего предка (orphan-ветки)',
      {
        tag: ['@VCS-10675', Priority.NORMAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const defaultPushResult = await git.generateFilesAndPushAll(1);
          expect(defaultPushResult).toBeOk();
        });

        const orphanBranchName = dataGenerator.gitBranch();
        const switchResult = await git.switchToOrphanBranch(orphanBranchName);
        expect(switchResult).toBeOk();

        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const orphanBranchPushResult = await git.generateFilesAndPushAll(1);
          expect(orphanBranchPushResult).toBeOk();
        });

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        const response = await apiClient.get(path, {
          params: {
            from: repoInfo.default_branch,
            to: orphanBranchName,
          },
        });

        await HttpResponseAssertions.conflict(response, {
          title: 'Невозможно получить разницу',
          detail: 'Нет общего предка (orphan-ветки)',
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии read',
      {
        tag: ['@VCS-10676', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
          private: true,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.assertRepoPrivilege(repoOptions, user.name, PrivilegeGroup.NONE);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Значения по умолчанию',
      {
        tag: ['@VCS-10677', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
          private: false,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.resetCache(tenantInfo.id);

        await privilegeService.assertRepoPrivilege(repoOptions, user.name, PrivilegeGroup.READER);

        const commitsApi = apiRegistry.v1.repos.commits.withBasic(user);
        const defaultBranchLastCommitSha = await commitsApi.getLastCommitSha(repoOptions, repoInfo.default_branch);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCompareCommitsResponse,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              total_items: 0,
            }),
            data: [],
            diffInfo: {
              base_commit: defaultBranchLastCommitSha,
              merge_base_commit: defaultBranchLastCommitSha,
              head_commit: defaultBranchLastCommitSha,
              total_commits: 0,
              total_files: 0,
              status: 'identical',
            },
          }),
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Выполнение запроса с токеном со скоупом repo',
      {
        tag: ['@VCS-10678', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
          private: false,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);

        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zCompareCommitsResponse,
        });
      },
    );

    REF_COMBINATIONS.forEach(({ title, fromValueSupplier, toValueSupplier }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Сравнение ${title} (behind)`,
        {
          tag: ['@VCS-10679', Priority.NORMAL],
        },
        async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

          const git = await gitService.getConfiguredGit(user);
          const cloneResult = await git.clone(repoInfo.links.clone);
          expect(cloneResult).toBeOk();

          const branchName = dataGenerator.gitBranch();
          const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
          expect(checkoutBranchResult).toBeOk();

          let commitSummary;
          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const generateCommitsResult = await git.generateCommitsAndPush();
            expect(generateCommitsResult).toBeOk();
            commitSummary = generateCommitsResult.result!;
          });

          const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const fromValue = await Promise.resolve(fromValueSupplier(git, dataGenerator, branchName, branchSha));
          const toValue = await Promise.resolve(
            toValueSupplier(git, dataGenerator, repoInfo.default_branch, defaultSha),
          );

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, {
            params: {
              from: fromValue,
              to: toValue,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: expect.objectContaining({
              pagination: expect.objectContaining({
                total_items: commitSummary!.commitCount,
              }),
              data: expect.hasLength(commitSummary!.commitCount),
              diffInfo: {
                base_commit: branchSha,
                head_commit: defaultSha,
                merge_base_commit: defaultSha,
                total_commits: commitSummary!.commitCount,
                total_files: commitSummary!.fileCount,
                status: 'behind',
              },
            }),
          });
        },
      );
    });

    REF_COMBINATIONS.forEach(({ title, fromValueSupplier, toValueSupplier }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Сравнение ${title} (identical)`,
        {
          tag: ['@VCS-10680', Priority.NORMAL],
        },
        async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

          const git = await gitService.getConfiguredGit(user);
          const cloneResult = await git.clone(repoInfo.links.clone);
          expect(cloneResult).toBeOk();

          const branchName = dataGenerator.gitBranch();
          const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
          expect(checkoutBranchResult).toBeOk();

          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const pushResult = await git.push();
            expect(pushResult).toBeOk();
          });

          const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const fromValue = await Promise.resolve(fromValueSupplier(git, dataGenerator, branchName, branchSha));
          const toValue = await Promise.resolve(
            toValueSupplier(git, dataGenerator, repoInfo.default_branch, defaultSha),
          );

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, {
            params: {
              from: fromValue,
              to: toValue,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: expect.objectContaining({
              pagination: expect.objectContaining({
                total_items: 0,
              }),
              data: [],
              diffInfo: {
                base_commit: defaultSha,
                merge_base_commit: defaultSha,
                head_commit: defaultSha,
                total_commits: 0,
                total_files: 0,
                status: 'identical',
              },
            }),
          });
        },
      );
    });

    REF_COMBINATIONS.forEach(({ title, fromValueSupplier, toValueSupplier }) => {
      test(
        `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Сравнение ${title} (derived)`,
        {
          tag: ['@VCS-10681', Priority.NORMAL],
        },
        async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, {
            auto_init: true,
          });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

          const git = await gitService.getConfiguredGit(user);
          const cloneResult = await git.clone(repoInfo.links.clone);
          expect(cloneResult).toBeOk();

          const initShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(initShaResult).toBeOk();
          const mergeBaseSha = initShaResult.result!;

          const branchName = dataGenerator.gitBranch();
          const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
          expect(checkoutBranchResult).toBeOk();

          let branchCommitSummary;
          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const branchCommitsMessageResult = await git.generateCommitsAndPush();
            expect(branchCommitsMessageResult).toBeOk();
            branchCommitSummary = branchCommitsMessageResult.result!;
          });

          const checkoutDefaultBranchResult = await git.checkout(repoInfo.default_branch);
          expect(checkoutDefaultBranchResult).toBeOk();

          let defaultBranchCommitSummary;
          await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
            const defaultBranchCommitsMessageResult = await git.generateCommitsAndPush();
            expect(defaultBranchCommitsMessageResult).toBeOk();
            defaultBranchCommitSummary = defaultBranchCommitsMessageResult.result!;
          });

          const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
          expect(defaultShaResult).toBeOk();
          const defaultSha = defaultShaResult.result!;

          const branchShaResult = await git.getShaByRef(branchName);
          expect(branchShaResult).toBeOk();
          const branchSha = branchShaResult.result!;

          const fromValue = await Promise.resolve(
            fromValueSupplier(git, dataGenerator, repoInfo.default_branch, defaultSha),
          );
          const toValue = await Promise.resolve(toValueSupplier(git, dataGenerator, branchName, branchSha));

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path, {
            params: {
              from: fromValue,
              to: toValue,
            },
          });

          const totalCommitCount = branchCommitSummary!.commitCount + defaultBranchCommitSummary!.commitCount;
          const totalFileCount = branchCommitSummary!.fileCount + defaultBranchCommitSummary!.fileCount;

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: expect.objectContaining({
              pagination: expect.objectContaining({
                total_items: totalCommitCount,
              }),
              data: expect.hasLength(totalCommitCount),
              diffInfo: {
                base_commit: defaultSha,
                head_commit: branchSha,
                merge_base_commit: mergeBaseSha,
                total_commits: totalCommitCount,
                total_files: totalFileCount,
                status: 'derived',
              },
            }),
          });
        },
      );
    });

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 404 Not Found — Передан несуществующий номер страницы',
      {
        tag: ['@VCS-10687', Priority.MINOR],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        const response = await apiClient.get(path, { params: { page: 2 } });
        await HttpResponseAssertions.notFound(response, {
          title: 'Превышение лимита',
          detail: 'Страницы с таким номером page не существует',
          instance: path,
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:owner/:repo/compare/commits — 200 OK — Пагинация коммитов`,
      {
        tag: ['@VCS-10688', Priority.NORMAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService, gitService, dataGenerator }) => {
        const commitCount = 11;
        const totalPages = Math.ceil(commitCount / MIN_PAGINATION_LIMIT);

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, {
          auto_init: true,
        });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        let commitResult;
        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const branchCommitsMessageResult = await git.generateCommitsAndPush(commitCount);
          expect(branchCommitsMessageResult).toBeOk();
          commitResult = branchCommitsMessageResult.result!;
        });

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);

        await step('Получение 1-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              from: repoInfo.default_branch,
              to: branchName,
              page: 1,
              limit: MIN_PAGINATION_LIMIT,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: {
              pagination: {
                current_page: 1,
                per_page: MIN_PAGINATION_LIMIT,
                total_pages: totalPages,
                total_items: commitCount,
              },
              data: expect.hasLength(10),
              diffInfo: {
                base_commit: defaultSha,
                merge_base_commit: defaultSha,
                head_commit: branchSha,
                total_commits: commitCount,
                total_files: commitResult!.fileCount,
                status: 'ahead',
              },
            },
          });
        });

        await step('Получение 2-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              from: repoInfo.default_branch,
              to: branchName,
              page: 2,
              limit: MIN_PAGINATION_LIMIT,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zCompareCommitsResponse,
            data: {
              pagination: {
                current_page: 2,
                per_page: MIN_PAGINATION_LIMIT,
                total_pages: totalPages,
                total_items: commitCount,
              },
              data: expect.hasLength(1),
              diffInfo: {
                base_commit: defaultSha,
                merge_base_commit: defaultSha,
                head_commit: branchSha,
                total_commits: commitCount,
                total_files: commitResult!.fileCount,
                status: 'ahead',
              },
            },
          });
        });
      },
    );
  },
);
