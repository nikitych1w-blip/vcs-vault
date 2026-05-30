import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { zGitCommitEvent } from '@vcs-pw/api/generated/types/kafka/elk/commit/zod.gen';
import { ProjectInfo } from '@vcs-pw/api/v2/projects/projects.api';
import { RepoOptions } from '@vcs-pw/api/v3';
import { GitWrapper } from '@vcs-pw/services/git.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { getFileExt } from '@vcs-pw/utils/file.util';

const EVENT_TYPE = 'COMMIT';
const PUSH_EVENT_CODE = 'PUSH';

interface ThisTestContext {
  projectInfo: ProjectInfo;
  repoOptions: RepoOptions;
  repoInfo: RepositoryV3ZodType;
  git: GitWrapper;
}

test.describe(
  'Kafka. Событие коммита',
  {
    tag: [Layer.API, '@kafka', '@commit-event'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Топик для события существует', async ({ kafkaService }) => {
      const topic = kafkaService.topics.commits;
      await kafkaService.expectTopicExists(topic);
    });

    test.beforeEach(
      'Создание репозитория',
      async ({ tenantInfo, entityManager, privilegeService, user, gitService, testContext }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        testContext.put({ projectInfo, repoOptions, repoInfo, git });
      },
    );

    test(
      `Отправка события коммита — Пустой коммит`,
      {
        tag: ['@VCS-10998', Priority.MINOR],
      },
      async ({ testContext, kafkaService, dataGenerator }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const commitMessage = dataGenerator.faker.git.commitMessage();
        const commitResult = await git.commit(commitMessage, undefined, { '--allow-empty': null });
        expect(commitResult).toBeOk();

        const pushResult = await git.push();
        expect(pushResult).toBeOk();

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const commitSha = shaResult.result!;

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: EVENT_TYPE,
              event_code: PUSH_EVENT_CODE,
            },
            payload: {
              sc_commit_sha: commitSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_commit_message_txt: commitMessage,
              sc_commit_sha: commitSha,
              sc_deleted_row_cnt: 0,
              sc_inserted_row_cnt: 0,
              sc_file_extension_type_list: null,
              sc_file_path: null,
              sc_merge_bool: false,
              sc_modified_file_list: [],
              sc_source_file_language_name: null,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — Добавление файлов`,
      {
        tag: ['@VCS-10999', Priority.CRITICAL],
        annotation: [
          Annotation.DESCRIPTION(
            'Дополнительно проверяется заполнение общих полей в событии (информация о проекте, репо и т.д.) + генерируется событие по каждому файлу',
          ),
        ],
      },
      async ({ config, testContext, kafkaService, user, tenantInfo }) => {
        const { projectInfo, repoInfo, git } = testContext as unknown as ThisTestContext;

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const commitSha = shaResult.result!;

        const initShaResult = await git.getShaByRef('HEAD~1');
        expect(initShaResult).toBeOk();
        const initCommitSha = initShaResult.result!;

        const diffResult = await git.countLinesDiffInSingleCommit(repoInfo.default_branch);
        expect(diffResult).toBeOk();

        const addedFilesMetadata = diffResult.result!.map(async (fileDiff) => {
          return {
            sc_inserted_row_cnt: fileDiff.added,
            sc_deleted_row_cnt: 0,
            sc_file_path: fileDiff.path,
            sc_file_extension_type_list: getFileExt(fileDiff.path),
          };
        });

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(
          topic,
          {
            value: {
              context: {
                entity_type: EVENT_TYPE,
                event_code: PUSH_EVENT_CODE,
              },
              payload: {
                sc_commit_sha: commitSha,
              },
            },
          },
          addedFiles.length,
        );

        const expectedEvents = addedFilesMetadata.map((fileMetadata) => ({
          context: {
            entity_type: EVENT_TYPE,
            event_code: PUSH_EVENT_CODE,
            event_createTs: expect.timestampCloseTo(),
            event_id: expect.uuid(),
            tenant_id: tenantInfo.id,
          },
          metadata: {
            message_create_ts: expect.timestampCloseTo(),
            message_id: expect.uuid(),
            producer: { id: kafkaService.issuer },
            version: '1.0.0',
          },
          initiator_user: { id: String(user.id) },
          payload: expect.objectContaining({
            ...fileMetadata,
            sc_commit_author_name: user.fullName,
            sc_commit_author_login: user.name,
            sc_commit_author_email: user.email,
            sc_commit_dttm: expect.stringIso(),
            sc_merge_bool: false,
            sc_modified_file_list: expect.arrayEqualsInAnyOrder(addedFiles),
            sc_branch_name: `refs/heads/${repoInfo.default_branch}`,
            sc_uid: expect.uuid(),
            sc_source_file_language_name: expect.anything(),
            sc_project_name: projectInfo.name,
            sc_project_domain_name: kafkaService.issuer,
            sc_repository_name: repoInfo.name,
            sc_commit_sha: commitSha,
            sc_parent_commit_sha: initCommitSha,
            sc_parent_commit_id_list: [initCommitSha],
            sc_commit_message_txt: expect.any(String),
            sc_url: config.ui.baseUrl,
            sbertrack_issue_url: null,
          }),
        }));

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(addedFiles.length);
          const values = events.map((event) => event.value);
          expect.soft(values).toMatchObject(expectedEvents);
          values.forEach(async (value) => await expect.soft(value).toMatchZodSchema(zGitCommitEvent));
        });
      },
    );

    test(
      `Отправка события коммита — Удаление файла`,
      {
        tag: ['@VCS-11000', Priority.NORMAL],
      },
      async ({ testContext, kafkaService }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const fileToRemove = addedFiles[0];
        const removeResult = await git.remove(fileToRemove);
        expect(removeResult).toBeOk();

        const pushResult = await git.commitAllAndPush();
        expect(pushResult).toBeOk();

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const commitSha = shaResult.result!;

        const diffResult = await git.countLinesDiffInSingleCommit(repoInfo.default_branch);
        expect(diffResult).toBeOk();

        const delFileDiff = diffResult.result![0];

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: EVENT_TYPE,
              event_code: PUSH_EVENT_CODE,
            },
            payload: {
              sc_commit_sha: commitSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_inserted_row_cnt: 0,
              sc_deleted_row_cnt: delFileDiff.deleted,
              sc_file_path: delFileDiff.path,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — Изменение файла`,
      {
        tag: ['@VCS-11005', Priority.NORMAL],
      },
      async ({ testContext, kafkaService, fileSystemService }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const fileToEdit = addedFiles[0];
        await fileSystemService.createOrOverrideFile(fileToEdit, git.dir);

        const pushResult = await git.commitAllAndPush();
        expect(pushResult).toBeOk();

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const commitSha = shaResult.result!;

        const diffResult = await git.countLinesDiffInSingleCommit(repoInfo.default_branch);
        expect(diffResult).toBeOk();

        const editFileDiff = diffResult.result![0];

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: EVENT_TYPE,
              event_code: PUSH_EVENT_CODE,
            },
            payload: {
              sc_commit_sha: commitSha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_inserted_row_cnt: editFileDiff.added,
              sc_deleted_row_cnt: editFileDiff.deleted,
              sc_file_path: editFileDiff.path,
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — merge-коммит`,
      {
        tag: ['@VCS-11002', Priority.CRITICAL],
      },
      async ({ testContext, kafkaService, dataGenerator }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const defaultSha = defaultShaResult.result!;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const checkoutToDefaultBranchResult = await git.checkout(repoInfo.default_branch);
        expect(checkoutToDefaultBranchResult).toBeOk();

        const mergeResult = await git.mergeNoFastForward(branchName);
        expect(mergeResult).toBeOk();

        const pushResult = await git.push();
        expect(pushResult).toBeOk();

        const mergeShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(mergeShaResult).toBeOk();
        const mergeSha = mergeShaResult.result!;

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(
          topic,
          {
            value: {
              context: {
                entity_type: EVENT_TYPE,
                event_code: PUSH_EVENT_CODE,
              },
              payload: {
                sc_commit_sha: mergeSha,
              },
            },
          },
          addedFiles.length,
        );

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(addedFiles.length);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_commit_message_txt: expect.stringContaining('Merge branch'),
              sc_merge_bool: true,
              sc_parent_commit_sha: defaultSha,
              sc_parent_commit_id_list: [defaultSha, branchSha],
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — Коммит без родителей (orphan-ветка)`,
      {
        tag: ['@VCS-11004', Priority.MINOR],
      },
      async ({ testContext, kafkaService, dataGenerator }) => {
        const { git } = testContext as unknown as ThisTestContext;

        const branchName = dataGenerator.gitBranch();
        const checkoutBranchResult = await git.switchToOrphanBranch(branchName);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
        const addedFiles = generateCommitsResult.result!.files;

        const branchShaResult = await git.getShaByRef(branchName);
        expect(branchShaResult).toBeOk();
        const branchSha = branchShaResult.result!;

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(
          topic,
          {
            value: {
              context: {
                entity_type: EVENT_TYPE,
                event_code: PUSH_EVENT_CODE,
              },
              payload: {
                sc_commit_sha: branchSha,
              },
            },
          },
          addedFiles.length,
        );

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(addedFiles.length);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_parent_commit_sha: '',
              sc_parent_commit_id_list: [],
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — Бинарный файл`,
      {
        tag: ['@VCS-11050', Priority.NORMAL],
      },
      async ({ testContext, kafkaService, fileSystemService }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const { relativePath } = await fileSystemService.generateBinaryFile(git.dir);
        await expect(relativePath).toExist(git.dir);

        const commitsAndPushResult = await git.commitAllAndPush();
        expect(commitsAndPushResult).toBeOk();

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const sha = shaResult.result!;

        const diffResult = await git.countLinesDiffInSingleCommit(repoInfo.default_branch);
        expect(diffResult).toBeOk();

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(topic, {
          value: {
            context: {
              entity_type: EVENT_TYPE,
              event_code: PUSH_EVENT_CODE,
            },
            payload: {
              sc_commit_sha: sha,
            },
          },
        });

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(1);
          const value = events[0].value;
          expect.soft(value).toMatchObject({
            payload: expect.objectContaining({
              sc_deleted_row_cnt: null,
              sc_inserted_row_cnt: null,
              sc_file_path: relativePath,
              sc_modified_file_list: [relativePath],
            }),
          });
          await expect.soft(value).toMatchZodSchema(zGitCommitEvent);
        });
      },
    );

    test(
      `Отправка события коммита — Определение языка`,
      {
        tag: ['@VCS-11003', Priority.NORMAL],
        annotation: [Annotation.DESCRIPTION('ЯП определяется для каждого файла корректно')],
      },
      async ({ testContext, kafkaService, fileSystemService }) => {
        const { repoInfo, git } = testContext as unknown as ThisTestContext;

        const javaFilePath = await fileSystemService.generateFileFromResource(
          git.dir,
          'testdata/languages/App.java',
          '.java',
        );
        const pythonFilePath = await fileSystemService.generateFileFromResource(
          git.dir,
          'testdata/languages/main.py',
          '.py',
        );

        const commitsAndPushResult = await git.commitAllAndPush();
        expect(commitsAndPushResult).toBeOk();

        const shaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(shaResult).toBeOk();
        const sha = shaResult.result!;

        const topic = kafkaService.topics.commits;
        const events = await kafkaService.fetchEventsByFilter(
          topic,
          {
            value: {
              context: {
                entity_type: EVENT_TYPE,
                event_code: PUSH_EVENT_CODE,
              },
              payload: {
                sc_commit_sha: sha,
              },
            },
          },
          2,
        );

        await step('Проверка ответа', async () => {
          expect.soft(events).toHaveLength(2);
          const values = events.map((event) => event.value);
          expect.soft(values).toMatchObject([
            {
              payload: expect.objectContaining({
                sc_source_file_language_name: 'Java',
                sc_file_path: javaFilePath.relativePath,
              }),
            },
            {
              payload: expect.objectContaining({
                sc_source_file_language_name: 'Python',
                sc_file_path: pythonFilePath.relativePath,
              }),
            },
          ]);
          values.forEach(async (value) => await expect.soft(value).toMatchZodSchema(zGitCommitEvent));
        });
      },
    );
  },
);
