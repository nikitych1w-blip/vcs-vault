import { zV3GetPrIssuesResponse } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { sortByFields } from '@vcs-pw/utils/object.util';

const FIRST_PULL_INDEX = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 10;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions, index: number) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}/pulls/${index}/issues`;

test.describe(
  'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues',
  {
    tag: [Layer.API, '@v3', '@get-issues'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 200 OK — Получение непустого списка связанных задач`,
      {
        tag: ['@VCS-15196', Priority.CRITICAL],
      },
      async ({
        user,
        apiRegistry,
        tenantInfo,
        entityManager,
        privilegeService,
        unitTaskTrackerService,
        dataGenerator,
        authService,
        taskTrackerIntegrationService,
        gitService,
        config,
      }) => {
        const project = await taskTrackerIntegrationService.createProject(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: project };
        const space = project.toUpperCase();

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

        const units = await unitTaskTrackerService.createUnits(space, 4);
        const unitCodes = units.map((unit) => unit.code);
        const stringUnitCodes = [...unitCodes].join(' ');

        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[0], 1);
        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[1], 2);
        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[2], 3);

        await unitTaskTrackerService.changePriority(unitCodes[0], 'high');
        await unitTaskTrackerService.changePriority(unitCodes[1], 'mid');
        await unitTaskTrackerService.changePriority(unitCodes[2], 'low');

        const updatedUnitInfos = await Promise.all(
          unitCodes.map((unitCode) => unitTaskTrackerService.getUnit(unitCode)),
        );

        const context = await authService.createAuthenticatedSession(user);
        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);

        const pullOptions = dataGenerator.createPullRequest({
          title: `${stringUnitCodes} ${dataGenerator.faker.lorem.sentence()}`,
          base: repoInfo.default_branch,
          head: branchName,
        });
        await pullsApi.createPull(repoOptions, pullOptions);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        const expectedIssueInfos = updatedUnitInfos.map((unitInfo) => ({
          code: unitInfo.code,
          title: unitInfo.summary,
          status: unitTaskTrackerService.getUnitState(unitInfo),
          url: `${config.tt?.baseUrl}/units/all/unit/${unitInfo.code}`,
          priority: unitTaskTrackerService.getUnitPriority(unitInfo) ?? '',
        }));
        const sortedExpectedUnits = sortByFields(expectedIssueInfos, ['code:asc']);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zV3GetPrIssuesResponse,
          data: {
            pagination: {
              current_page: 1,
              per_page: DEFAULT_LIMIT,
              total_pages: 1,
              total_items: updatedUnitInfos.length,
            },
            issues: sortedExpectedUnits,
          },
        });
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 200 OK — Получение пустого списка связанных задач`,
      {
        tag: ['@VCS-15314', Priority.NORMAL],
      },
      async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          zodSchema: zV3GetPrIssuesResponse,
          data: {
            pagination: {
              current_page: 1,
              per_page: DEFAULT_LIMIT,
              total_pages: 0,
              total_items: 0,
            },
            issues: [],
          },
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 403 Forbidden — Нет прав на получение PR (привилегия read)',
      {
        tag: ['@VCS-15315', Priority.CRITICAL],
      },
      async ({ user, userPool, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true, private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

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
        tag: '@VCS-15198',
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
        tag: '@VCS-15200',
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
        tag: '@VCS-15199',
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
        tag: '@VCS-15322',
        title: 'Передан индекс несуществующего PR',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX * 10,
        generateDetailMessage: (_: RepoOptions) => `PR с таким индексом не найден`,
      },
      {
        tag: '@VCS-15345',
        title: 'Передан номер несуществующей страницы',
        generateRepoOptions: (repoOptions: RepoOptions, _: DataGenerator) => repoOptions,
        index: FIRST_PULL_INDEX,
        page: 2,
        generateDetailMessage: (_: RepoOptions) => 'Страница 2 не найдена',
      },
    ].forEach(({ tag, title, generateRepoOptions, index, page, generateDetailMessage }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 404 Not Found — ${title}`,
        {
          tag: [tag, Priority.NORMAL],
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
      { tag: '@VCS-15346', sort: 'code:desc' },
      { tag: '@VCS-15351', sort: 'status' },
      { tag: '@VCS-15352', sort: 'title:asc' },
      { tag: '@VCS-15353', sort: 'priority:desc' },
    ].forEach(({ tag, sort }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 200 OK — Сортировка ${sort}`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({
          user,
          apiRegistry,
          tenantInfo,
          entityManager,
          privilegeService,
          unitTaskTrackerService,
          dataGenerator,
          authService,
          taskTrackerIntegrationService,
          gitService,
          config,
        }) => {
          const project = await taskTrackerIntegrationService.createProject(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: project };
          const space = project.toUpperCase();

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

          const units = await unitTaskTrackerService.createUnits(space, 4);
          const unitCodes = units.map((unit) => unit.code);
          const stringUnitCodes = [...unitCodes].reverse().join(' ');

          await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[0], 1);
          await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[1], 2);
          await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[2], 3);

          await unitTaskTrackerService.changePriority(unitCodes[0], 'high');
          await unitTaskTrackerService.changePriority(unitCodes[1], 'mid');
          await unitTaskTrackerService.changePriority(unitCodes[2], 'low');

          const updatedUnitInfos = await Promise.all(
            unitCodes.map((unitCode) => unitTaskTrackerService.getUnit(unitCode)),
          );

          const context = await authService.createAuthenticatedSession(user);
          const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);

          const pullOptions = dataGenerator.createPullRequest({
            title: `${stringUnitCodes} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: branchName,
          });
          await pullsApi.createPull(repoOptions, pullOptions);

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, { params: { sort } });

          const expectedIssueInfos = updatedUnitInfos.map((unitInfo) => ({
            code: unitInfo.code,
            title: unitInfo.summary,
            status: unitTaskTrackerService.getUnitState(unitInfo),
            url: `${config.tt?.baseUrl}/units/all/unit/${unitInfo.code}`,
            priority: unitTaskTrackerService.getUnitPriority(unitInfo) ?? '',
          }));
          const sortedExpectedUnits = sortByFields(expectedIssueInfos, [sort]);

          await HttpResponseAssertions.ok(response, {
            zodSchema: zV3GetPrIssuesResponse,
            data: {
              pagination: {
                current_page: 1,
                per_page: DEFAULT_LIMIT,
                total_pages: 1,
                total_items: sortedExpectedUnits.length,
              },
              issues: sortedExpectedUnits,
            },
          });
        },
      );
    });

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 200 OK — Пагинация отсортированных задач`,
      {
        tag: ['@VCS-15357', Priority.NORMAL],
      },
      async ({
        user,
        apiRegistry,
        tenantInfo,
        entityManager,
        privilegeService,
        unitTaskTrackerService,
        dataGenerator,
        authService,
        taskTrackerIntegrationService,
        gitService,
        config,
      }) => {
        const sort = 'title:desc';
        const limit = MIN_LIMIT;
        const unitCount = limit + 1;
        const totalPages = Math.ceil(unitCount / limit);

        const project = await taskTrackerIntegrationService.createProject(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: project };
        const space = project.toUpperCase();

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

        const units = await unitTaskTrackerService.createUnits(space, unitCount);
        const stringUnitCodes = units.map((unit) => unit.code).join(' ');

        const context = await authService.createAuthenticatedSession(user);
        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);

        const pullOptions = dataGenerator.createPullRequest({
          title: `${stringUnitCodes} ${dataGenerator.faker.lorem.sentence()}`,
          base: repoInfo.default_branch,
          head: branchName,
        });
        await pullsApi.createPull(repoOptions, pullOptions);

        const path = toPath(repoOptions, FIRST_PULL_INDEX);
        const apiClient = apiRegistry.client.withBasic(user);

        const expectedIssueInfos = units.map((unitInfo) => ({
          code: unitInfo.code,
          title: unitInfo.summary,
          status: unitTaskTrackerService.getUnitState(unitInfo),
          url: `${config.tt?.baseUrl}/units/all/unit/${unitInfo.code}`,
          priority: unitTaskTrackerService.getUnitPriority(unitInfo) ?? '',
        }));
        const sortedExpectedUnits = sortByFields(expectedIssueInfos, [sort]);

        await step('Получение 1-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              page: 1,
              limit,
              sort,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zV3GetPrIssuesResponse,
            data: {
              issues: sortedExpectedUnits.slice(0, limit),
              pagination: {
                current_page: 1,
                per_page: limit,
                total_pages: totalPages,
                total_items: unitCount,
              },
            },
          });
        });

        await step('Получение 2-й страницы', async () => {
          const response = await apiClient.get(path, {
            params: {
              page: 2,
              limit,
              sort,
            },
          });

          await HttpResponseAssertions.ok(response, {
            zodSchema: zV3GetPrIssuesResponse,
            data: {
              pagination: {
                current_page: 2,
                per_page: limit,
                total_pages: totalPages,
                total_items: unitCount,
              },
              issues: sortedExpectedUnits.slice(limit),
            },
          });
        });
      },
    );

    [
      {
        tag: '@VCS-15340',
        title: 'Передано значение лимита 9',
        generateParams: (_: DataGenerator) => ({ limit: 9 }),
        validationError: {
          location: 'param',
          name: 'limit',
          error: 'Некорректно указан параметр запроса limit. Допустимое значение от 10 до 100',
          code: 'invalid_query_param_limit',
        },
      },
      {
        tag: '@VCS-15341',
        title: 'Передано значение лимита 101',
        generateParams: (_: DataGenerator) => ({ limit: 101 }),
        validationError: {
          location: 'param',
          name: 'limit',
          error: 'Некорректно указан параметр запроса limit. Допустимое значение от 10 до 100',
          code: 'invalid_query_param_limit',
        },
      },
      {
        tag: '@VCS-15342',
        title: 'Передано значение страницы 0',
        generateParams: (_: DataGenerator) => ({ page: 0 }),
        validationError: {
          location: 'param',
          name: 'page',
          error: 'Некорректно указан параметр запроса page. Допустимое значение - целое натуральное число',
          code: 'invalid_query_param_page',
        },
      },
      {
        tag: '@VCS-15343',
        title: 'Передано значение невалидное значение sort',
        generateParams: (dg: DataGenerator) => ({ sort: dg.faker.lorem.word() }),
        validationError: {
          location: 'param',
          name: 'sort',
          error:
            "Некорректный формат параметра 'sort'. Ожидается список не более 3 полей через запятую с необязательным указанием порядка (:asc или :desc). Поддерживаемые поля: `code`, `status`, `title`, `priority`. Пример: code:desc,priority:asc",
          code: 'invalid_query_param_sort',
        },
      },
      {
        tag: '@VCS-15344',
        title: 'Передано 4 поля в качестве значения sort',
        generateParams: (_: DataGenerator) => ({ sort: 'code,status:desc,title,priority' }),
        validationError: {
          location: 'param',
          name: 'sort',
          error:
            "Некорректный формат параметра 'sort'. Ожидается список не более 3 полей через запятую с необязательным указанием порядка (:asc или :desc). Поддерживаемые поля: `code`, `status`, `title`, `priority`. Пример: code:desc,priority:asc",
          code: 'invalid_query_param_sort',
        },
      },
    ].forEach(({ tag, title, generateParams, validationError }) => {
      test(
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 400 Bad Request — ${title}`,
        {
          tag: [tag, Priority.MINOR],
        },
        async ({ user, tenantInfo, entityManager, privilegeService, apiRegistry, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

          await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

          const path = toPath(repoOptions, FIRST_PULL_INDEX);
          const params = generateParams(dataGenerator);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, {
            params,
          });

          await HttpResponseAssertions.badRequest(response, { validation: [validationError] });
        },
      );
    });

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 200 OK — Вызов с токеном со скоупом repo`,
      {
        tag: ['@VCS-15316', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        const [pullInfo, _] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);

        const path = toPath(repoOptions, Number(pullInfo.index));
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo`,
      {
        tag: ['@VCS-15317', Priority.NORMAL],
      },
      async ({ user, apiRegistry, entityManager, tenantInfo, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        const [pullInfo, _] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const path = toPath(repoOptions, Number(pullInfo.index));
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-15318', Priority.MINOR],
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-15197', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, dataGenerator.faker.number.int());
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
        `GET /api/v3/repos/:tenant/:project/:repo/pulls/:index/issues — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-15197', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions, dataGenerator.faker.number.int());
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
