import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { ApiRegistry } from '@vcs-pw/services/api.service';
import { AuthService } from '@vcs-pw/services/auth.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { User } from '@vcs-pw/types/user.type';
import { Endpoint } from '@vcs-pw/ui';

const FIRST_PULL_INDEX = 1;
const MERGE_STRATEGIES = ['merge', 'squash', 'rebase', 'rebase-merge'] as const;

/**
 * var pullRequestCodeRE = regexp.MustCompile("[A-Z_0-9]{1,30}-[0-9]{1,30}")
 * var branchCodeRE = regexp.MustCompile("[^/_a-zа-я-][A-Z_0-9]{1,30}-[0-9]{1,30}")
 * Тесты проводятся при UNITS_VALIDATION = true
 */

const newWebPullsApi = async (apiRegistry: ApiRegistry, authService: AuthService, user: User) => {
  const context = await authService.createAuthenticatedSession(user);
  return apiRegistry.web.v1.repo.pulls.withRequest(context.request);
};

const PULL_API_TYPES = [
  {
    apiType: 'API v3',
    newPullsApi: async (apiRegistry: ApiRegistry, _: AuthService, user: User) =>
      apiRegistry.v3.repos.pulls.pulls.withBasic(user),
  },
  {
    apiType: 'API Web v1',
    newPullsApi: newWebPullsApi,
  },
] as const;

interface ThisTestContext {
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  branchName: string;
  space: string;
  git: GitWrapper;
}

test.describe(
  'TaskTracker. Связь Pull Request с юнитом',
  {
    tag: ['@tt'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll(({ config }) => {
      test.skip(!config.tt, 'Отсутствует интеграция с TaskTracker');
    });

    test.beforeEach(
      'Создание ветки с коммитом',
      async ({
        user,
        tenantInfo,
        testContext,
        gitService,
        dataGenerator,
        entityManager,
        taskTrackerIntegrationService,
        privilegeService,
      }) => {
        const project = await taskTrackerIntegrationService.createProject(tenantInfo.tenant_key);

        const privilegeGroup = PrivilegeGroup.MANAGER;
        const projectOptions = {
          tenantId: tenantInfo.id,
          projectName: project,
        };
        await privilegeService.grantToProject(projectOptions, user.name, privilegeGroup);

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        const space = repoOptions.projectName.toUpperCase();
        testContext.put({ repoOptions, repoInfo, branchName, space, git });
      },
    );

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Код юнита распознается в заголовке при создании PR (${apiType})`,
        {
          tag: ['@VCS-12090', Priority.CRITICAL, Layer.API],
          annotation: [
            Annotation.DESCRIPTION(`
              1. Код юнита успешно распознается со стороны SC.
              2. Данные по номеру и статусу (OPENED) PR со стороны ТТ корректны.`),
          ],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

          const unitInfo = (await unitTaskTrackerService.createUnits(space, 1))[0];

          const pullOptions = dataGenerator.createPullRequest({
            title: `${unitInfo.code} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
          const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
          const pullId = pullIdInfo.id;

          const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unitInfo.code, 1);
          expect.soft(unitPulls[0]).toEqual({
            id: pullId,
            url: expect.stringMatching(new RegExp(`/${repoOptions.projectName}/${repoOptions.repoName}/pulls/1`, 'i')),
            status: 'OPENED',
          });

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          const issuesList = await pullsApiV3.getIssues(repoOptions, FIRST_PULL_INDEX);

          expect(issuesList.issues).toHaveLength(1);
          expect(issuesList.issues[0]).toEqual({
            title: unitInfo.summary,
            code: unitInfo.code,
            status: unitTaskTrackerService.getUnitState(unitInfo),
            url: expect.stringContaining(unitInfo.code),
            priority: unitTaskTrackerService.getUnitPriority(unitInfo) ?? '',
          });
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Код юнита распознается в ветке при создании PR (${apiType})`,
        {
          tag: ['@VCS-12091', Priority.CRITICAL, Layer.API],
          annotation: [
            Annotation.DESCRIPTION(`
              1. Указано несколько юнитов (3).`),
          ],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 3);
          const unitCodes = units.map((unit) => unit.code);

          const unitBranchName = `feature/${unitCodes.join('-')}-${dataGenerator.faker.lorem.word()}`;
          const checkoutBranchResult = await git.checkoutBranch(unitBranchName, branchName);
          expect(checkoutBranchResult).toBeOk();

          const pushResult = await git.push();
          expect(pushResult).toBeOk();

          const pullOptions = dataGenerator.createPullRequest({
            title: dataGenerator.faker.lorem.sentence(),
            base: repoInfo.default_branch,
            head: unitBranchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
          const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
          const pullId = pullIdInfo.id;

          for (const unit of units) {
            const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unit.code, 1);
            expect.soft(unitPulls[0]).toEqual({
              id: pullId,
              url: expect.stringMatching(
                new RegExp(`/${repoOptions.projectName}/${repoOptions.repoName}/pulls/1`, 'i'),
              ),
              status: 'OPENED',
            });
          }

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          const issuesList = await pullsApiV3.getIssues(repoOptions, FIRST_PULL_INDEX);

          expect(issuesList.issues).toHaveLength(units.length);
          expect(issuesList.issues).toMatchObject(
            units.map((unit) => ({
              title: unit.summary,
              code: unit.code,
              status: unitTaskTrackerService.getUnitState(unit),
              url: expect.stringContaining(unit.code),
              priority: unitTaskTrackerService.getUnitPriority(unit) ?? '',
            })),
          );
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Код юнита распознается в сообщении коммита при создании PR (${apiType})`,
        {
          tag: ['@VCS-12092', Priority.CRITICAL, Layer.API],
          annotation: [
            Annotation.DESCRIPTION(`
              1. Указано несколько юнитов (2).`),
          ],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 2);
          const unitCodes = units.map((unit) => unit.code);

          const commitMessage = unitCodes.map((code) => `${code} ${dataGenerator.faker.lorem.sentence()}`).join('\n');
          const pushResult = await git.generateFilesAndPushAll(1, commitMessage);
          expect(pushResult).toBeOk();

          const pullOptions = dataGenerator.createPullRequest({
            title: dataGenerator.faker.lorem.sentence(),
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
          const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
          const pullId = pullIdInfo.id;

          for (const unit of units) {
            const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unit.code, 1);
            expect.soft(unitPulls[0]).toEqual({
              id: pullId,
              url: expect.stringMatching(
                new RegExp(`/${repoOptions.projectName}/${repoOptions.repoName}/pulls/1`, 'i'),
              ),
              status: 'OPENED',
            });
          }

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          const issuesList = await pullsApiV3.getIssues(repoOptions, FIRST_PULL_INDEX);

          expect(issuesList.issues).toHaveLength(units.length);
          expect(issuesList.issues).toMatchObject(
            units.map((unit) => ({
              title: unit.summary,
              code: unit.code,
              status: unitTaskTrackerService.getUnitState(unit),
              url: expect.stringContaining(unit.code),
              priority: unitTaskTrackerService.getUnitPriority(unit) ?? '',
            })),
          );
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Синхронизация статуса PR (OPENED->CLOSED) (${apiType})`,
        {
          tag: ['@VCS-12072', Priority.NORMAL, Layer.API],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

          const unit = (await unitTaskTrackerService.createUnits(space, 1))[0];

          const pullOptions = dataGenerator.createPullRequest({
            title: `Declined PR ${unit.code} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
          const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
          const pullId = pullIdInfo.id;

          const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unit.code, 1);
          expect.soft(unitPulls[0]).toMatchObject({
            id: pullId,
            status: 'OPENED',
          });

          await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);
          const updatedUnitPulls = await unitTaskTrackerService.expectUnitPullsCountByStatus(unit.code, {
            CLOSED: 1,
          });
          expect.soft(updatedUnitPulls.CLOSED?.[0]).toMatchObject({
            id: pullId,
            status: 'CLOSED',
          });
        },
      );
    });

    MERGE_STRATEGIES.forEach((mergeStrategy) => {
      PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
        test(
          `Синхронизация статуса PR (OPENED->MERGED) (${apiType}) (${mergeStrategy})`,
          {
            tag: ['@VCS-12073', Priority.NORMAL, Layer.API],
          },
          async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
            const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

            const unit = (await unitTaskTrackerService.createUnits(space, 1))[0];

            const pullOptions = dataGenerator.createPullRequest({
              title: `Merged PR ${unit.code} ${dataGenerator.faker.lorem.sentence()}`,
              base: repoInfo.default_branch,
              head: branchName,
            });
            const pullsApi = await newPullsApi(apiRegistry, authService, user);
            await pullsApi.createPull(repoOptions, pullOptions);

            const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
            const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
            const pullId = pullIdInfo.id;

            const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unit.code, 1);
            expect.soft(unitPulls[0]).toMatchObject({
              id: pullId,
              status: 'OPENED',
            });

            const branchShaResult = await git.getShaByRef(branchName);
            expect(branchShaResult).toBeOk();
            const branchSha = branchShaResult.result!;

            await pullsApi.mergePull(repoOptions, FIRST_PULL_INDEX, {
              merge_method: mergeStrategy,
              head_commit_id: branchSha,
            });

            const updatedUnitPulls = await unitTaskTrackerService.expectUnitPullsCountByStatus(unit.code, {
              MERGED: 1,
            });
            expect.soft(updatedUnitPulls.MERGED?.[0]).toMatchObject({
              id: pullId,
              status: 'MERGED',
            });
          },
        );
      });
    });

    test(
      'Синхронизация статуса PR (CLOSED->OPENED) (API Web v1)',
      {
        tag: ['@VCS-12076', Priority.NORMAL, Layer.API],
      },
      async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
        const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

        const unit = (await unitTaskTrackerService.createUnits(space, 1))[0];

        const pullOptions = dataGenerator.createPullRequest({
          title: `Reopened PR ${unit.code} ${dataGenerator.faker.lorem.sentence()}`,
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = await newWebPullsApi(apiRegistry, authService, user);
        await pullsApi.createPull(repoOptions, pullOptions);

        const pullsApiV1 = apiRegistry.v1.repos.pulls.withBasic(user);
        const pullIdInfo = await pullsApiV1.getPull(repoOptions, FIRST_PULL_INDEX);
        const pullId = pullIdInfo.id;

        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);
        const closedUnitPulls = await unitTaskTrackerService.expectUnitPullsCountByStatus(unit.code, {
          CLOSED: 1,
        });
        expect.soft(closedUnitPulls.CLOSED?.[0]).toMatchObject({
          id: pullId,
          status: 'CLOSED',
        });

        await pullsApi.reopenPull(repoOptions, FIRST_PULL_INDEX);
        const openedUnitPulls = await unitTaskTrackerService.expectUnitPullsCountByStatus(unit.code, {
          OPENED: 1,
        });
        expect.soft(openedUnitPulls.OPENED?.[0]).toMatchObject({
          id: pullId,
          status: 'OPENED',
        });
      },
    );

    test(
      'Удаление PR удаляет связи в юните (API Web v1)',
      {
        tag: ['@VCS-12077', Priority.NORMAL, Layer.API],
        annotation: [
          Annotation.DESCRIPTION(`
          1. Удалить можно любой PR (declined, opened, merged).`),
        ],
      },
      async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
        const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

        const units = await unitTaskTrackerService.createUnits(space, 2);

        const pullOptions = dataGenerator.createPullRequest({
          title: `Deleted PR ${units.map((unit) => unit.code).join(',')} ${dataGenerator.faker.lorem.sentence()}`,
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = await newWebPullsApi(apiRegistry, authService, user);
        await pullsApi.createPull(repoOptions, pullOptions);

        for (const unit of units) {
          await unitTaskTrackerService.expectUnitPullsCount(unit.code, 1);
        }

        await pullsApi.deletePull(repoOptions, FIRST_PULL_INDEX);
        for (const unit of units) {
          await unitTaskTrackerService.expectUnitPullsCount(unit.code, 0);
        }
      },
    );

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Изменение заголовка PR обновляет список связанных задач (${apiType})`,
        {
          tag: ['@VCS-12078', Priority.NORMAL, Layer.API],
          annotation: [
            Annotation.DESCRIPTION(`
              1. Добавление новых.
              2. Замена на другой.
              3. Полная очистка.`),
          ],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 3);
          const unitCodes = units.map((unit) => unit.code);

          const pullOptions = dataGenerator.createPullRequest({
            title: dataGenerator.faker.lorem.sentence(),
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 0);

          await pullsApi.changeTitle(
            repoOptions,
            FIRST_PULL_INDEX,
            `${dataGenerator.faker.lorem.sentence()} ${unitCodes.pop()}`,
          );
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 1);

          await pullsApi.changeTitle(repoOptions, FIRST_PULL_INDEX, unitCodes.join('/'));
          const updateLinks = await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 2);
          expect(updateLinks.map((link) => link.code)).toEqual(expect.arrayContaining(unitCodes));

          await pullsApi.changeTitle(repoOptions, FIRST_PULL_INDEX, dataGenerator.faker.lorem.sentence());
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 0);
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Добавление нового коммита в PR обновляет список связанных задач (${apiType})`,
        {
          tag: ['@VCS-12079', Priority.NORMAL, Layer.API],
          annotation: [
            Annotation.DESCRIPTION(`
            1. Добавление связанной задачи в коммите.
            2. Переопределение задачи через force push.`),
          ],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 3);
          const unitCodes = units.map((unit) => unit.code);

          const pullOptions = dataGenerator.createPullRequest({
            title: dataGenerator.faker.lorem.sentence(),
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 0);

          const commitMessage = `${unitCodes.pop()} ${dataGenerator.faker.lorem.sentence()}`;
          const pushResult = await git.generateFilesAndPushAll(1, commitMessage);
          expect(pushResult).toBeOk();
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 1);

          const amendResult = await git.amendCommitAndForcePush(unitCodes.join('-'));
          expect(amendResult).toBeOk();
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 2);

          const newAmendResult = await git.amendCommitAndForcePush(dataGenerator.faker.lorem.sentence());
          expect(newAmendResult).toBeOk();
          await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 0);
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Одновременно распознаются коды юнитов из заголовка, ветки и коммита при создании PR (${apiType})`,
        {
          tag: ['@VCS-12080', Priority.MINOR, Layer.API],
          annotation: [Annotation.DESCRIPTION('Дополнительно проверяется игнорирования дубликатов кодов')],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 3);
          const unitCodes = units.map((unit) => unit.code);

          const unitBranchName = `${unitCodes[0]}.${unitCodes[0]}-${dataGenerator.faker.lorem.word()}`;
          const checkoutBranchResult = await git.checkoutBranch(unitBranchName, branchName);
          expect(checkoutBranchResult).toBeOk();

          const pushResult = await git.generateFilesAndPushAll(1, `${unitCodes[1]} ${unitCodes[1]}`);
          expect(pushResult).toBeOk();

          const pullOptions = dataGenerator.createPullRequest({
            title: `${unitCodes[2]} ${unitCodes[2]} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: unitBranchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          const pullsApiV3 = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          const links = await pullsApiV3.expectIssuesCount(repoOptions, FIRST_PULL_INDEX, 3);

          expect(links.map((link) => link.code)).toEqual(expect.arrayContaining(unitCodes));
        },
      );
    });

    PULL_API_TYPES.forEach(({ apiType, newPullsApi }) => {
      test(
        `Больше 1 PR может быть связано с одним юнитом (${apiType})`,
        {
          tag: ['@VCS-12081', Priority.NORMAL, Layer.API],
        },
        async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService }) => {
          const { repoOptions, repoInfo, branchName, space, git } = testContext as unknown as ThisTestContext;

          const units = await unitTaskTrackerService.createUnits(space, 1);
          const unitCode = units[0].code;

          const newBranchName = dataGenerator.gitBranch();
          const checkoutBranchResult = await git.checkoutBranch(newBranchName, branchName);
          expect(checkoutBranchResult).toBeOk();

          const pushResult = await git.push();
          expect(pushResult).toBeOk();

          const pullsApi = await newPullsApi(apiRegistry, authService, user);

          const firstPullOptions = dataGenerator.createPullRequest({
            title: `${unitCode} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: branchName,
          });
          await pullsApi.createPull(repoOptions, firstPullOptions);

          const secondPullOptions = dataGenerator.createPullRequest({
            title: `${unitCode} ${dataGenerator.faker.lorem.sentence()}`,
            base: repoInfo.default_branch,
            head: newBranchName,
          });
          await pullsApi.createPull(repoOptions, secondPullOptions);

          const unitPulls = await unitTaskTrackerService.expectUnitPullsCount(unitCode, 2);
          expect.soft(unitPulls).toMatchObject([
            expect.objectContaining({
              url: expect.stringMatching(
                new RegExp(`/${repoOptions.projectName}/${repoOptions.repoName}/pulls/1`, 'i'),
              ),
            }),
            expect.objectContaining({
              url: expect.stringMatching(
                new RegExp(`/${repoOptions.projectName}/${repoOptions.repoName}/pulls/2`, 'i'),
              ),
            }),
          ]);
        },
      );
    });

    test(
      `Отображение юнитов на странице обсуждения PR`,
      {
        tag: ['@VCS-12083', Priority.CRITICAL, Layer.UI],
        annotation: [
          Annotation.DESCRIPTION(`
              1. Ссылки в заголовке кликабельны и введут на корректны стенд.
              2. Юниты отображаются в списке связанных задач по алфавиту.
              3. Ссылки в списке кликабельны.
              4. Отображается код, название, статус, приоритет.
              5. Для каждого приоритета отображается корректная иконка.`),
        ],
      },
      async ({ user, dataGenerator, apiRegistry, authService, testContext, unitTaskTrackerService, pageRegistry }) => {
        const { repoOptions, repoInfo, branchName, space } = testContext as unknown as ThisTestContext;

        const units = await unitTaskTrackerService.createUnits(space, 4);
        const unitCodes = units.map((unit) => unit.code);
        const stringUnitCodes = [...unitCodes].reverse().join(' ');

        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[0], 1);
        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[1], 2);
        await unitTaskTrackerService.changeStatusToRandomAvailable(unitCodes[2], 3);

        await unitTaskTrackerService.changePriority(unitCodes[0], 'high');
        await unitTaskTrackerService.changePriority(unitCodes[1], 'mid');
        await unitTaskTrackerService.changePriority(unitCodes[2], 'low');

        const context = await authService.createAuthenticatedSession(user);
        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);

        const pullOptions = dataGenerator.createPullRequest({
          title: `${stringUnitCodes} ${dataGenerator.faker.lorem.sentence()}`,
          base: repoInfo.default_branch,
          head: branchName,
        });
        await pullsApi.createPull(repoOptions, pullOptions);

        const page = await context.newPage();
        const pullOverviewPage = new pageRegistry.repo.pulls.overview(page);

        await pullOverviewPage.goToEndpoint(Endpoint.REPOSITORY_PULL_REQUEST, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          index: FIRST_PULL_INDEX,
        });
        await pullOverviewPage.expectToBeOpened();

        for (const unitCode of unitCodes) {
          const link = await pullOverviewPage.title.softExpect.toHaveLink(unitCode);
          await link.softExpect.toHaveAttributeValue('href', new RegExp(`https://.*/units/all/unit/${unitCode}`));
        }

        await pullOverviewPage.metas.linkedTasksSection.expect.toBeVisible();
        await pullOverviewPage.metas.linkedTasksSection.taskList.item.code.softExpect.toHaveText(unitCodes);

        for (let index = 0; index < unitCodes.length; index++) {
          const unit = await unitTaskTrackerService.getUnit(unitCodes[index]);
          const unitInfo = pullOverviewPage.metas.linkedTasksSection.taskList.item.nth(index);

          await unitInfo.code.softExpect.toHaveText(unit.code);
          await unitInfo.code.softExpect.toHaveAttributeValue(
            'href',
            new RegExp(`https://.*/units/all/unit/${unit.code}`),
          );

          await unitInfo.summary.softExpect.toHaveText(unit.summary);

          const workflowStatus = unitTaskTrackerService.getUnitState(unit);
          await unitInfo.status.softExpect.toHaveText(workflowStatus ?? '');

          const priority = unitTaskTrackerService.getUnitPriority(unit);
          const priorityClass = unitTaskTrackerService.priorityToIconClass(priority);
          await unitInfo.priority.softExpect.toBeVisible();
          await unitInfo.priority.softExpect.toContainClass(priorityClass);
        }
      },
    );
  },
);

// Не нужна подготовка с ТТ, так что вынос в отдельный тест
test.describe(
  'TaskTracker. Связь Pull Request с юнитом',
  {
    tag: ['@tt'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `При отсутствии связанных задач отображается пустой блок`,
      {
        tag: ['@VCS-12082', Priority.NORMAL, Layer.UI],
      },
      async ({
        user,
        tenantInfo,
        entityManager,
        privilegeService,
        pageRegistry,
        authService,
        gitService,
        dataGenerator,
        apiRegistry,
      }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        const context = await authService.createAuthenticatedSession(user);
        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);

        const pullOptions = dataGenerator.createPullRequest({
          title: dataGenerator.faker.lorem.sentence(),
          base: repoInfo.default_branch,
          head: branchName,
        });
        await pullsApi.createPull(repoOptions, pullOptions);

        const page = await context.newPage();
        const pullOverviewPage = new pageRegistry.repo.pulls.overview(page);

        await pullOverviewPage.goToEndpoint(Endpoint.REPOSITORY_PULL_REQUEST, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          index: FIRST_PULL_INDEX,
        });
        await pullOverviewPage.expectToBeOpened();

        await pullOverviewPage.metas.linkedTasksSection.expect.toBeVisible();
        await pullOverviewPage.metas.linkedTasksSection.placeholder.expect.toHaveText('Нет связанных задач');
      },
    );
  },
);
