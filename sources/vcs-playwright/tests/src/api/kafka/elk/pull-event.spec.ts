import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { zPullRequestEvent } from '@vcs-pw/api/generated/types/kafka/elk/pull/zod.gen';
import { ProjectInfo } from '@vcs-pw/api/v2/projects/projects.api';
import { RepoOptions } from '@vcs-pw/api/v3';
import { ApiRegistry } from '@vcs-pw/services/api.service';
import { AuthService } from '@vcs-pw/services/auth.service';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { User } from '@vcs-pw/types/user.type';

const ENTITY_TYPE = 'PULL REQUEST';
const ENTRY_DELIMITER = ', ';
const FIRST_PULL_INDEX = 1;
const COMMIT_COUNT = 1;
const MERGE_STRATEGIES = ['merge', 'squash', 'rebase', 'rebase-merge'] as const;

const newWebPullsApi = async (apiRegistry: ApiRegistry, authService: AuthService, user: User) => {
  const context = await authService.createAuthenticatedSession(user);
  return apiRegistry.web.v1.repo.pulls.withRequest(context.request);
};

const PULL_API_TYPES = [
  {
    title: 'API v3',
    newPullsApi: async (apiRegistry: ApiRegistry, _: AuthService, user: User) =>
      apiRegistry.v3.repos.pulls.pulls.withBasic(user),
  },
  {
    title: 'API Web v1',
    newPullsApi: newWebPullsApi,
  },
] as const;

interface ThisTestContext {
  projectInfo: ProjectInfo;
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  branchName: string;
  branchSha: string;
  defaultSha: string;
  git: GitWrapper;
  addedFiles: string[];
}

test.describe(
  'Kafka. Событие запроса на слияние',
  {
    tag: [Layer.API, '@kafka', '@pull-event'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Топик для события существует', async ({ kafkaService }) => {
      const topic = kafkaService.topics.pulls;
      await kafkaService.expectTopicExists(topic);
    });

    test.beforeEach(
      'Создание ветки с коммитом',
      async ({ tenantInfo, entityManager, privilegeService, user, gitService, dataGenerator, testContext }) => {
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

        const generateCommitsResult = await git.generateCommitsAndPush(COMMIT_COUNT);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        testContext.put({ projectInfo, repoOptions, repoInfo, branchName, branchSha, defaultSha, git, addedFiles });
      },
    );

    PULL_API_TYPES.forEach(({ title, newPullsApi }) => {
      test(
        `Отправка события по действию в PR (${title}) — OPENED`,
        {
          tag: ['@VCS-10782', Priority.CRITICAL],
          annotation: [Annotation.DESCRIPTION('PR создан')],
        },
        async ({
          testContext,
          config,
          tenantInfo,
          kafkaService,
          user,
          dataGenerator,
          apiRegistry,
          authService,
          databaseService,
        }) => {
          const { projectInfo, repoOptions, repoInfo, branchName, branchSha, defaultSha } =
            testContext as unknown as ThisTestContext;

          const pullOptions = dataGenerator.createPullRequest({
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
          await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

          const topic = kafkaService.topics.pulls;
          const events = await kafkaService.fetchEventsByFilter(topic, {
            value: {
              context: {
                entity_type: ENTITY_TYPE,
                event_code: 'OPENED',
              },
              payload: {
                sc_pull_request_from_commit_sha: branchSha,
              },
            },
          });

          await step('Проверка ответа', async () => {
            expect.soft(events).toHaveLength(1);
            const value = events[0].value;
            expect.soft(value).toMatchObject({
              context: {
                entity_type: ENTITY_TYPE,
                event_code: 'OPENED',
                event_createTs: expect.timestampCloseTo(),
                event_id: expect.uuid(),
                tenant_id: tenantInfo.id,
              },
              initiator_user: {
                id: String(user.id),
              },
              metadata: {
                message_create_ts: expect.timestampCloseTo(),
                message_id: expect.uuid(),
                producer: { id: config.kafka?.issuer },
                version: '1.0.0',
              },
              payload: {
                sc_url: config.ui.baseUrl,
                sc_pull_request_creation_dttm: expect.stringIsoMillisNoTz(),
                sbertrack_issue_url: null,
                sc_pull_request_action_type: 'OPENED',
                sc_pull_request_author_name: user.fullName,
                sc_pull_request_author_email: user.email,
                sc_pull_request_author_id: user.id,
                sc_pull_request_author_login: user.lowerName,
                sc_comment_action_type: null,
                sc_pull_request_from_branch_name: branchName,
                sc_pull_request_from_commit_sha: branchSha,
                sc_pull_request_from_repository_clone_url: repoInfo.links.clone,
                sc_pull_request_from_repository_id: expect.any(Number),
                sc_pull_request_from_repository_key: `${projectInfo.name}/${repoInfo.name}`,
                sc_pull_request_from_repository_name: repoInfo.name,
                sc_pull_request_from_project_id: projectInfo.id,
                sc_pull_request_from_project_name: projectInfo.name,
                sc_pull_request_from_ssh_clone_url: repoInfo.links.ssh,
                sc_pull_request_order_number: FIRST_PULL_INDEX,
                sc_merge_commit_sha: null,
                sc_pull_request_reviewer_login_list: null,
                sc_pull_request_reviewer_list: null,
                sc_pull_request_approver_cnt: 0,
                sc_pull_request_approver_name_list: null,
                sc_pull_request_approver_email_list: null,
                sc_pull_request_approver_login_list: null,
                sc_pull_request_reviewer_email_list: null,
                sc_pull_request_reviewer_id_list: null,
                sc_reviewer_need_work_cnt: 0,
                sc_reviewer_need_work_name_list: null,
                sc_reviewer_need_work_email_list: null,
                sc_reviewer_need_work_login_list: null,
                sc_unnaprover_cnt: 0,
                sc_unnaprover_name_list: null,
                sc_unnaprover_email_list: null,
                sc_unnaprover_login_list: null,
                sc_pull_request_state_type: 'OPEN',
                sc_pull_request_name: pullOptions.title,
                sc_pull_request_to_branch_name: repoInfo.default_branch,
                sc_pull_request_to_commit_sha: defaultSha,
                sc_pull_request_to_repository_clone_url: repoInfo.links.clone,
                sc_pull_request_to_branch_id: `refs/heads/${repoInfo.default_branch}`,
                sc_pull_request_to_repository_id: expect.any(Number),
                sc_pull_request_to_repository_key: `${projectInfo.name}/${repoInfo.name}`,
                sc_pull_request_to_repository_name: repoInfo.name,
                sc_pull_request_to_project_id: projectInfo.id,
                sc_pull_request_to_project_name: projectInfo.name,
                sc_pull_request_unique_id: `${projectInfo.name}/${repoInfo.name}#${FIRST_PULL_INDEX}`,
                sc_pull_request_url: `${repoInfo.links.html}/pulls/${FIRST_PULL_INDEX}`,
                sc_pull_request_status_changer_name: user.fullName,
                sc_pull_request_status_changer_email: user.email,
                sc_pull_request_status_changer_id: user.id,
                sc_pull_request_status_changer_login: user.lowerName,
              },
            });
            await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
          });
        },
      );
    });

    PULL_API_TYPES.forEach(({ title, newPullsApi }) => {
      test(
        `Отправка события по действию в PR (${title}) — DECLINED`,
        {
          tag: ['@VCS-10783', Priority.NORMAL],
          annotation: [Annotation.DESCRIPTION('PR закрыт без влития')],
        },
        async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
          const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

          const pullOptions = dataGenerator.createPullRequest({
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
          await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

          await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);

          const topic = kafkaService.topics.pulls;
          const events = await kafkaService.fetchEventsByFilter(topic, {
            value: {
              context: {
                entity_type: ENTITY_TYPE,
                event_code: 'DECLINED',
              },
              payload: {
                sc_pull_request_from_commit_sha: branchSha,
              },
            },
          });

          await step('Проверка ответа', async () => {
            expect.soft(events).toHaveLength(1);
            const value = events[0].value;
            expect.soft(value).toMatchObject({
              payload: expect.objectContaining({
                sc_pull_request_action_type: 'DECLINED',
                sc_pull_request_order_number: 1,
                sc_merge_commit_sha: null,
                sc_pull_request_state_type: 'DECLINED',
                sc_pull_request_status_changer_name: user.fullName,
                sc_pull_request_status_changer_email: user.email,
                sc_pull_request_status_changer_id: user.id,
                sc_pull_request_status_changer_login: user.lowerName,
              }),
            });
            await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
          });
        },
      );
    });

    test(
      `Отправка события по действию в PR (API Web v1) — REOPENED`,
      {
        tag: ['@VCS-10784', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('PR переоткрыт')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = await newWebPullsApi(apiRegistry, authService, user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);
        await pullsApi.reopenPull(repoOptions, FIRST_PULL_INDEX);

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'REOPENED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'REOPENED',
              sc_pull_request_order_number: 1,
              sc_merge_commit_sha: null,
              sc_pull_request_state_type: 'OPEN',
              sc_pull_request_status_changer_name: user.fullName,
              sc_pull_request_status_changer_email: user.email,
              sc_pull_request_status_changer_id: user.id,
              sc_pull_request_status_changer_login: user.lowerName,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    MERGE_STRATEGIES.forEach((mergeStrategy) => {
      PULL_API_TYPES.forEach(({ title, newPullsApi }) => {
        test(
          `Отправка события по действию в PR (${title}) — MERGED (${mergeStrategy})`,
          {
            tag: ['@VCS-10785', Priority.CRITICAL],
            annotation: [Annotation.DESCRIPTION('PR слит')],
          },
          async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
            const { repoOptions, repoInfo, branchName, branchSha, git } = testContext as unknown as ThisTestContext;

            const pullOptions = dataGenerator.createPullRequest({
              base: repoInfo.default_branch,
              head: branchName,
            });
            const pullsApi = await newPullsApi(apiRegistry, authService, user);
            await pullsApi.createPull(repoOptions, pullOptions);

            await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
            await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

            await pullsApi.mergePull(repoOptions, FIRST_PULL_INDEX, {
              merge_method: mergeStrategy,
              head_commit_id: branchSha,
            });

            const checkoutResult = await git.checkout(pullOptions.base);
            expect(checkoutResult).toBeOk();

            const pullResult = await git.pull();
            expect(pullResult).toBeOk();

            const mergeShaResult = await git.getShaByRef(pullOptions.base);
            expect(mergeShaResult).toBeOk();

            const topic = kafkaService.topics.pulls;
            const events = await kafkaService.fetchEventsByFilter(topic, {
              value: {
                context: {
                  entity_type: ENTITY_TYPE,
                  event_code: 'MERGED',
                },
                payload: {
                  sc_pull_request_from_commit_sha: branchSha,
                },
              },
            });

            await step('Проверка ответа', async () => {
              expect.soft(events).toHaveLength(1);
              const value = events[0].value;
              expect.soft(value).toMatchObject({
                payload: expect.objectContaining({
                  sc_pull_request_action_type: 'MERGED',
                  sc_pull_request_order_number: 1,
                  sc_merge_commit_sha: mergeShaResult.result!,
                  sc_pull_request_state_type: 'MERGED',
                  sc_pull_request_status_changer_name: user.fullName,
                  sc_pull_request_status_changer_email: user.email,
                  sc_pull_request_status_changer_id: user.id,
                  sc_pull_request_status_changer_login: user.lowerName,
                }),
              });
              await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
            });
          },
        );
      });
    });

    test(
      `Отправка события по действию в PR (API Web v1) — DELETED`,
      {
        tag: ['@VCS-10786', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('PR удален')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = await newWebPullsApi(apiRegistry, authService, user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        await pullsApi.deletePull(repoOptions, FIRST_PULL_INDEX);

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'DELETED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'DELETED',
              sc_pull_request_order_number: 1,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — COMMENTED (ADDED) (обсуждение)`,
      {
        tag: ['@VCS-10787', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('Добавлен комментарий в обсуждении')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;
        const context = await authService.createAuthenticatedSession(user);

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });

        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const commentsApi = apiRegistry.web.v1.repo.comments.withRequest(context.request);
        await commentsApi.createPullComment(repoOptions, FIRST_PULL_INDEX, dataGenerator.faker.lorem.sentence());

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'COMMENTED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'COMMENTED',
              sc_comment_action_type: 'ADDED',
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — COMMENTED (ADDED) (diff)`,
      {
        tag: ['@VCS-10788', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('Добавлен комментарий в diff')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha, addedFiles } = testContext as unknown as ThisTestContext;
        const context = await authService.createAuthenticatedSession(user);

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });

        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const commentsApi = apiRegistry.web.v1.repo.comments.withRequest(context.request);
        await commentsApi.createDiffComment(repoOptions, FIRST_PULL_INDEX, {
          latest_commit_id: branchSha,
          side: 'proposed',
          line: 1,
          path: addedFiles[0],
          content: dataGenerator.faker.lorem.sentence(),
          single_review: true,
        });

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'COMMENTED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'COMMENTED',
              sc_comment_action_type: 'ADDED',
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — COMMENTED (REPLIED)`,
      {
        tag: ['@VCS-10789', Priority.NORMAL],
        annotation: [
          Annotation.DESCRIPTION('Добавлен ответ на комментарий в ревью. Доп проверка корректного заполнения changer'),
        ],
      },
      async ({
        testContext,
        privilegeService,
        kafkaService,
        user,
        dataGenerator,
        apiRegistry,
        authService,
        userPool,
        databaseService,
      }) => {
        const { repoOptions, repoInfo, branchName, branchSha, addedFiles } = testContext as unknown as ThisTestContext;
        const context = await authService.createAuthenticatedSession(user);

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });

        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const commentCoordinates = {
          latest_commit_id: branchSha,
          side: 'proposed',
          line: 1,
          path: addedFiles[0],
          single_review: true,
        } as const;

        const commentsApi = apiRegistry.web.v1.repo.comments.withRequest(context.request);
        await commentsApi.createDiffComment(repoOptions, FIRST_PULL_INDEX, {
          ...commentCoordinates,
          content: dataGenerator.faker.lorem.sentence(),
        });

        // Выполнение действий от имени другого пользователя
        const secondUser = userPool.get();
        await privilegeService.grantToRepo(repoOptions, secondUser.name, PrivilegeGroup.WRITER);

        const reviewsApi = apiRegistry.v1.repos.reviews.withBasic(secondUser);

        const reviews = await reviewsApi.getReviews(repoOptions, FIRST_PULL_INDEX);
        expect(reviews).toHaveLength(1);
        const reviewId = reviews[0].id;

        const secondContext = await authService.createAuthenticatedSession(secondUser);
        const secondCommentsApi = apiRegistry.web.v1.repo.comments.withRequest(secondContext.request);

        await secondCommentsApi.replyDiffComment(repoOptions, FIRST_PULL_INDEX, {
          ...commentCoordinates,
          content: dataGenerator.faker.lorem.sentence(),
          reply: reviewId,
        });

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'COMMENTED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
              sc_comment_action_type: 'REPLIED',
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'COMMENTED',
              sc_pull_request_status_changer_name: secondUser.fullName,
              sc_pull_request_status_changer_email: secondUser.email,
              sc_pull_request_status_changer_id: secondUser.id,
              sc_pull_request_status_changer_login: secondUser.lowerName,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — COMMENTED (EDITED)`,
      {
        tag: ['@VCS-10790', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('Изменен комментарий в ревью')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha, addedFiles } = testContext as unknown as ThisTestContext;
        const context = await authService.createAuthenticatedSession(user);

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });

        const pullsApi = apiRegistry.web.v1.repo.pulls.withRequest(context.request);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const commentCoordinates = {
          latest_commit_id: branchSha,
          side: 'proposed',
          line: 1,
          path: addedFiles[0],
          single_review: true,
        } as const;

        const commentsApi = apiRegistry.web.v1.repo.comments.withRequest(context.request);
        await commentsApi.createDiffComment(repoOptions, FIRST_PULL_INDEX, {
          ...commentCoordinates,
          content: dataGenerator.faker.lorem.sentence(),
        });
        const reviewsApi = apiRegistry.v1.repos.reviews.withBasic(user);
        const reviews = await reviewsApi.getReviews(repoOptions, FIRST_PULL_INDEX);
        expect(reviews).toHaveLength(1);
        const reviewId = reviews[0].id;

        const comments = await reviewsApi.getReviewComments(repoOptions, FIRST_PULL_INDEX, reviewId);
        expect(comments).toHaveLength(1);
        const commentId = comments[0].id;

        await commentsApi.editComment(repoOptions, commentId, dataGenerator.faker.lorem.paragraph());

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'COMMENTED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
              sc_comment_action_type: 'EDITED',
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'COMMENTED',
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — RESCOPED_TO`,
      {
        tag: ['@VCS-10791', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('В PR изменена целевая ветка')],
      },
      async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
        const { repoOptions, repoInfo, branchName, branchSha, defaultSha, git } =
          testContext as unknown as ThisTestContext;

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
        });
        const pullsApi = await newWebPullsApi(apiRegistry, authService, user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const newBranchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(newBranchName, pullOptions.base);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();

        await pullsApi.changeTargetBranch(repoOptions, FIRST_PULL_INDEX, newBranchName);

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'RESCOPED_TO',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'RESCOPED_TO',
              sc_pull_request_to_branch_name: newBranchName,
              sc_pull_request_to_commit_sha: defaultSha, // mergeBase не изменилась
              sc_pull_request_to_branch_id: `refs/heads/${newBranchName}`,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    PULL_API_TYPES.forEach(({ title, newPullsApi }) => {
      test(
        `Отправка события по действию в PR (${title}) — UPDATED`,
        {
          tag: ['@VCS-10792', Priority.MINOR],
          annotation: [Annotation.DESCRIPTION('Обновлен заголовок PR')],
        },
        async ({ testContext, kafkaService, user, dataGenerator, apiRegistry, authService, databaseService }) => {
          const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

          const pullOptions = dataGenerator.createPullRequest({
            base: repoInfo.default_branch,
            head: branchName,
          });
          const pullsApi = await newPullsApi(apiRegistry, authService, user);
          await pullsApi.createPull(repoOptions, pullOptions);

          await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
          await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

          await pullsApi.changeTitle(repoOptions, FIRST_PULL_INDEX, dataGenerator.faker.lorem.sentence());

          const topic = kafkaService.topics.pulls;
          const events = await kafkaService.fetchEventsByFilter(topic, {
            value: {
              context: {
                entity_type: ENTITY_TYPE,
                event_code: 'UPDATED',
              },
              payload: {
                sc_pull_request_from_commit_sha: branchSha,
              },
            },
          });

          await step('Проверка ответа', async () => {
            expect.soft(events).toHaveLength(1);
            const value = events[0].value;
            expect.soft(value).toMatchObject({
              payload: expect.objectContaining({
                sc_pull_request_action_type: 'UPDATED',
              }),
            });
            await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
          });
        },
      );
    });

    test(
      `Отправка события по действию в PR (API Web v1) — APPROVED`,
      {
        tag: ['@VCS-10793', Priority.CRITICAL],
        annotation: [Annotation.DESCRIPTION('Выставлен approve')],
      },
      async ({
        testContext,
        kafkaService,
        user,
        dataGenerator,
        apiRegistry,
        authService,
        userPool,
        privilegeService,
        databaseService,
      }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

        const reviewer = userPool.get();
        await privilegeService.grantToRepo(repoOptions, reviewer.name, PrivilegeGroup.WRITER);

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
          reviewers: [reviewer.name],
        });
        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const reviewerContext = await authService.createAuthenticatedSession(reviewer);
        const reviewsApi = apiRegistry.web.v1.repo.reviews.withRequest(reviewerContext.request);
        await reviewsApi.createApproveReview(repoOptions, FIRST_PULL_INDEX, {
          commit_id: branchSha,
          content: dataGenerator.faker.lorem.sentence(),
        });

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'APPROVED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'APPROVED',
              sc_pull_request_reviewer_email_list: reviewer.email,
              sc_pull_request_reviewer_id_list: String(reviewer.id),
              sc_pull_request_reviewer_list: reviewer.fullName,
              sc_pull_request_reviewer_login_list: reviewer.name,
              sc_reviewer_need_work_cnt: 0,
              sc_unnaprover_cnt: 0,
              sc_pull_request_approver_cnt: 1,
              sc_pull_request_approver_email_list: reviewer.email,
              sc_pull_request_approver_login_list: reviewer.name,
              sc_pull_request_approver_name_list: reviewer.fullName,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — UNAPPROVED`,
      {
        tag: ['@VCS-10794', Priority.CRITICAL],
        annotation: [Annotation.DESCRIPTION('Выставлен unapprove')],
      },
      async ({
        testContext,
        kafkaService,
        user,
        dataGenerator,
        apiRegistry,
        authService,
        userPool,
        privilegeService,
        databaseService,
      }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

        const reviewers = [userPool.get(), userPool.get()];
        for (const reviewer of reviewers) {
          await privilegeService.grantToRepo(repoOptions, reviewer.name, PrivilegeGroup.WRITER);
        }

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
          reviewers: reviewers.map((reviewer) => reviewer.name),
        });
        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        const unapprovedReviewer = reviewers[0];
        const reviewerContext = await authService.createAuthenticatedSession(unapprovedReviewer);
        const reviewsApi = apiRegistry.web.v1.repo.reviews.withRequest(reviewerContext.request);
        await reviewsApi.createRejectReview(repoOptions, FIRST_PULL_INDEX, {
          commit_id: branchSha,
          content: dataGenerator.faker.lorem.sentence(),
        });

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: ENTITY_TYPE,
              event_code: 'UNAPPROVED',
            },
            payload: {
              sc_pull_request_from_commit_sha: branchSha,
            },
          },
        });

        const ids = reviewers.map((reviewer) => reviewer.id);
        const emails = reviewers.map((reviewer) => reviewer.email);
        const logins = reviewers.map((reviewer) => reviewer.name);
        const names = reviewers.map((reviewer) => reviewer.fullName);

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'UNAPPROVED',
              sc_pull_request_reviewer_email_list: expect.stringConsistsOf(emails, ENTRY_DELIMITER),
              sc_pull_request_reviewer_id_list: expect.stringConsistsOf(ids, ENTRY_DELIMITER),
              sc_pull_request_reviewer_list: expect.stringConsistsOf(names, ENTRY_DELIMITER),
              sc_pull_request_reviewer_login_list: expect.stringConsistsOf(logins, ENTRY_DELIMITER),
              sc_pull_request_approver_cnt: 0,
              sc_reviewer_need_work_cnt: 0,
              sc_unnaprover_cnt: 1,
              sc_unnaprover_email_list: unapprovedReviewer.email,
              sc_unnaprover_login_list: unapprovedReviewer.name,
              sc_unnaprover_name_list: unapprovedReviewer.fullName,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );

    test(
      `Отправка события по действию в PR (API Web v1) — REVIEWED`,
      {
        tag: ['@VCS-10795', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('Выставлен needs works')],
      },
      async ({
        testContext,
        kafkaService,
        user,
        dataGenerator,
        apiRegistry,
        authService,
        userPool,
        privilegeService,
        databaseService,
      }) => {
        const { repoOptions, repoInfo, branchName, branchSha } = testContext as unknown as ThisTestContext;

        const reviewers = [userPool.get(), userPool.get()];
        for (const reviewer of reviewers) {
          await privilegeService.grantToRepo(repoOptions, reviewer.name, PrivilegeGroup.WRITER);
        }

        const pullOptions = dataGenerator.createPullRequest({
          base: repoInfo.default_branch,
          head: branchName,
          reviewers: reviewers.map((reviewer) => reviewer.name),
        });
        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
        await pullsApi.createPull(repoOptions, pullOptions);

        await databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, FIRST_PULL_INDEX, COMMIT_COUNT);
        await databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, FIRST_PULL_INDEX);

        for (const reviewer of reviewers) {
          const reviewerContext = await authService.createAuthenticatedSession(reviewer);
          const reviewsApi = apiRegistry.web.v1.repo.reviews.withRequest(reviewerContext.request);
          await reviewsApi.createCommentReview(repoOptions, FIRST_PULL_INDEX, {
            commit_id: branchSha,
            content: dataGenerator.faker.lorem.sentence(),
          });
        }

        const topic = kafkaService.topics.pulls;
        const events = await kafkaService.fetchEventsByFilter(
          topic,
          {
            value: {
              context: {
                entity_type: ENTITY_TYPE,
                event_code: 'REVIEWED',
              },
              payload: {
                sc_pull_request_from_commit_sha: branchSha,
              },
            },
          },
          2,
        );

        const ids = reviewers.map((reviewer) => reviewer.id);
        const emails = reviewers.map((reviewer) => reviewer.email);
        const logins = reviewers.map((reviewer) => reviewer.name);
        const names = reviewers.map((reviewer) => reviewer.fullName);

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(2);
          const value = events[1].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_pull_request_action_type: 'REVIEWED',
              sc_pull_request_reviewer_email_list: expect.stringConsistsOf(emails, ENTRY_DELIMITER),
              sc_pull_request_reviewer_id_list: expect.stringConsistsOf(ids, ENTRY_DELIMITER),
              sc_pull_request_reviewer_list: expect.stringConsistsOf(names, ENTRY_DELIMITER),
              sc_pull_request_reviewer_login_list: expect.stringConsistsOf(logins, ENTRY_DELIMITER),
              sc_pull_request_approver_cnt: 0,
              sc_unnaprover_cnt: 0,
              sc_reviewer_need_work_cnt: 2,
              sc_reviewer_need_work_name_list: expect.stringConsistsOf(names, ENTRY_DELIMITER),
              sc_reviewer_need_work_email_list: expect.stringConsistsOf(emails, ENTRY_DELIMITER),
              sc_reviewer_need_work_login_list: expect.stringConsistsOf(logins, ENTRY_DELIMITER),
            }),
          });
          await expect.soft(value).toMatchZodSchema(zPullRequestEvent);
        });
      },
    );
  },
);
