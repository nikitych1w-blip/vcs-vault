import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { PullRequestCreatePayloadZodType, zPrInfo } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { RepoOptions as RepoOptionsV3 } from '@vcs-pw/api/v3';
import { RepoOptions } from '@vcs-pw/api/web';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { ATTACHMENT_ALLOWED_EXTENSIONS, KILOBYTE } from '@vcs-pw/types/sc-settings.type';
import { getRandomElement } from '@vcs-pw/utils/object.util';

const toPath = ({ projectName, repoName }: RepoOptions) => `/web/v2/repos/${projectName}/${repoName}/pulls`;

interface ThisTestContext {
  repoOptions: RepoOptionsV3;
  repoInfo: RepositoryV3ZodType;
}

test.describe(
  'POST /web/v2/repos/:owner/:repo/pulls',
  {
    tag: [Layer.API, '@web', '@v2', '@create-pull'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeEach('Создание репозитория', async ({ tenantInfo, entityManager, testContext }) => {
      const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
      const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

      const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
      const repoOptions = { ...projectOptions, repoName: repoInfo.name };

      testContext.put({
        repoOptions,
        repoInfo,
      });
    });

    test(
      `POST /web/v2/repos/:owner/:repo/pulls — 201 Created — Создание запрос на слияние`,
      {
        tag: ['@VCS-13256', Priority.CRITICAL],
        annotation: [Annotation.DESCRIPTION('Заполнены все поля. Проверка привилегии create_pr (входит во write)')],
      },
      async ({
        user,
        testContext,
        apiRegistry,
        authService,
        privilegeService,
        dataGenerator,
        entityManager,
        gitService,
        userPool,
        fileSystemService,
      }) => {
        const { repoOptions, repoInfo } = testContext as unknown as ThisTestContext;
        const labelCount = 3;

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        let commitsSummary;
        const branchName = dataGenerator.gitBranch();
        await entityManager.waitForRepoUpdateAfterAction(repoOptions, async () => {
          const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
          expect(checkoutBranchResult).toBeOk();

          const generateCommitsResult = await git.generateCommitsAndPush(1);
          expect(generateCommitsResult).toBeOk();
          commitsSummary = generateCommitsResult.result!;
        });

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const milestonesApi = apiRegistry.v1.repos.milestones.withBasic(user);
        const milestoneInfo = await milestonesApi.createMilestone(repoOptions, {
          title: dataGenerator.faker.lorem.word(),
        });

        const labelsApi = apiRegistry.v1.repos.labels.withBasic(user);
        const labelPromises = Array.from({ length: labelCount }, () =>
          labelsApi.createLabel(repoOptions, {
            name: dataGenerator.faker.lorem.word(),
            color: dataGenerator.faker.color.rgb(),
          }),
        );
        const labelInfos = await Promise.all(labelPromises);
        const labelIds = labelInfos.map((label) => label.id);

        const reviewers = [userPool.get(), userPool.get()];
        const reviewerIds = reviewers.map((user) => user.id as unknown as bigint);
        for (const { name } of reviewers) {
          await privilegeService.grantToRepo(repoOptions, name, PrivilegeGroup.WRITER);
        }

        const tempDir = await fileSystemService.createTempDir();
        const extension = getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS);
        const { content, relativePath } = await fileSystemService.generateBinaryFile(tempDir, extension, KILOBYTE);

        const context = await authService.createAuthenticatedSession(user);

        const attachmentsWebApi = apiRegistry.web.v2.projects.repos.attachments.withRequest(context.request);
        const attachmentsInfo = await attachmentsWebApi.uploadAttachments(repoOptions, [
          {
            fileName: relativePath,
            content,
          },
        ]);
        const attachmentIds = attachmentsInfo.results
          .map((result) => result.data?.upload_uid)
          .filter((uid): uid is string => !!uid);

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READ_CREATE);

        const body: PullRequestCreatePayloadZodType = {
          title: dataGenerator.faker.lorem.sentence(),
          description: dataGenerator.faker.lorem.paragraph(),
          from_branch: branchName,
          to_branch: repoInfo.default_branch,
          reviewer_ids: reviewerIds,
          label_ids: labelIds,
          milestone_id: milestoneInfo.id,
          attachments: attachmentIds,
        };
        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.post(path, {
          data: body,
        });

        await HttpResponseAssertions.created(response, {
          data: {
            base: {
              name: body.to_branch,
              sha: defaultSha,
            },
            body: {
              attachments: body.attachments,
              description: body.description,
            },
            changed_files_count: commitsSummary!.fileCount,
            closed_at: null,
            commits_count: commitsSummary!.commitCount,
            created_at: expect.stringIso(),
            discuss_count: 0,
            head: {
              name: body.from_branch,
              sha: branchSha,
            },
            index: 1,
            is_locked: false,
            is_watching: true,
            merge_info: null,
            mergeable: true,
            pr_creator: {
              avatar_url: expect.stringContaining('avatars'),
              full_name: user.fullName,
              id: user.id,
              username: user.name,
            },
            state: 'open',
            title: body.title,
            updated_at: expect.stringIso(),
            url: `${repoInfo.links.html}/pulls/1`,
          },
          zodSchema: zPrInfo,
          xRequestIdHeader: false,
        });
      },
    );

    test(
      `POST /web/v2/repos/:owner/:repo/pulls — 401 Unauthorized — Заголовок Authorization содержит невалидный JWT`,
      {
        tag: ['@VCS-13255', Priority.CRITICAL],
      },
      async ({ apiRegistry, dataGenerator }) => {
        const fakeRepoOptions = {
          projectName: dataGenerator.faker.string.ulid(),
          repoName: dataGenerator.faker.string.ulid(),
        };

        const path = toPath(fakeRepoOptions);
        const apiClient = apiRegistry.client.anonymous();

        const response = await apiClient.post(path, {
          headers: { Authorization: `Bearer ${dataGenerator.faker.string.alphanumeric(10)}` },
        });

        await HttpResponseAssertions.unauthorizedWeb(response);
      },
    );
  },
);
