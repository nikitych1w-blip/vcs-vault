import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_MAX_SIZE,
  ATTACHMENT_MAX_SIZE_IN_MB,
  generateValidAttachmentSize,
} from '@vcs-pw/types/sc-settings.type';
import { Endpoint } from '@vcs-pw/ui';
import { StatusClass } from '@vcs-pw/ui/components/repo/upload-preview.component';
import PullOverviewPage from '@vcs-pw/ui/pages/repo/pulls/pull-overview.page';
import { getRandomElement } from '@vcs-pw/utils/object.util';
import { uploadKey } from '@vcs-pw/utils/s3.util';

const FIRST_PULL_INDEX = 1;

interface ThisTestContext {
  pullOverviewPage: PullOverviewPage;
}

test.describe(
  'S3. Вложения',
  {
    tag: [Layer.UI, '@s3', '@attachments'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Бакет существует', async ({ s3Service }) => {
      const isBucketExists = await s3Service.isBucketExists();
      expect(isBucketExists).toBe(true);
    });

    test.beforeEach(
      'Создание запроса на слияние и открытие страницы с ним',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext, authService, pageRegistry }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        await privilegeService.waitForRepoPrivilege(repoOptions, user.name, PrivilegeGroup.WRITER);

        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const pullOverviewPage = new pageRegistry.repo.pulls.overview(page);

        await pullOverviewPage.goToEndpoint(Endpoint.REPOSITORY_PULL_REQUEST, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          index: FIRST_PULL_INDEX,
        });
        await pullOverviewPage.expectToBeOpened();

        testContext.put({ pullOverviewPage });
      },
    );

    test(
      'S3. Вложения — Добавление вложения в комментарий в обсуждении запроса на слияние',
      {
        tag: ['@VCS-11636', Priority.CRITICAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          generateValidAttachmentSize(dataGenerator),
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const message = dataGenerator.faker.lorem.sentence();
        await commentForm.message.fill(message);
        await commentForm.submit.click();

        const comment = pullOverviewPage.timeline.comment;
        await comment.expect.toHaveCount(1);
        await comment.nth(0).attachment.expect.toHaveCount(1);

        await s3Service.attachments.waitForExistence(fileKey);
      },
    );

    test(
      'S3. Вложения — Удаляется файл в S3 при удалении комментария',
      {
        tag: ['@VCS-12595', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          generateValidAttachmentSize(dataGenerator),
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const message = dataGenerator.faker.lorem.sentence();
        await commentForm.message.fill(message);
        await commentForm.submit.click();

        const comment = pullOverviewPage.timeline.comment;
        await comment.expect.toHaveCount(1);

        await comment.delete();

        await comment.expect.toHaveCount(0);
        await s3Service.attachments.waitForAbsence(fileKey);
      },
    );

    test(
      'S3. Вложения — Удаляется файл в S3 при удалении вложения через редактирование комментария',
      {
        tag: ['@VCS-12593', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          generateValidAttachmentSize(dataGenerator),
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const message = dataGenerator.faker.lorem.sentence();
        await commentForm.message.fill(message);
        await commentForm.submit.click();

        const comment = pullOverviewPage.timeline.comment;
        await comment.expect.toHaveCount(1);

        await comment.startEdit();
        await comment.editForm.uploadZone.uploadPreview.remove.click();

        await comment.editForm.uploadZone.uploadPreview.expect.toHaveCount(0);
        await comment.editForm.save.click();

        await s3Service.attachments.waitForAbsence(fileKey);
      },
    );

    test(
      'S3. Вложения — Добавление файла размером 0 байт',
      {
        tag: ['@VCS-13158', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          0,
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const fileInfo = await s3Service.attachments.get(fileKey);
        const s3FileContent = await fileInfo.Body?.transformToByteArray();
        expect(s3FileContent).toHaveLength(0);
      },
    );

    test(
      'S3. Вложения — Добавление файла размером MAX_SIZE',
      {
        tag: ['@VCS-13159', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath, content } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          ATTACHMENT_MAX_SIZE,
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const fileInfo = await s3Service.attachments.get(fileKey);
        const s3FileContent = await fileInfo.Body?.transformToString();
        expect(s3FileContent).toBe(content.toString());
      },
    );

    test(
      'S3. Вложения — Добавление файла размером MAX_SIZE+1',
      {
        tag: ['@VCS-11637', Priority.NORMAL],
      },
      async ({ testContext, fileSystemService }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          ATTACHMENT_MAX_SIZE + 1,
        );

        const uploadZone = pullOverviewPage.timeline.commentForm.uploadZone;

        await uploadZone.message.expect.toBeVisible();
        await uploadZone.chooseFiles([absolutePath]);

        await uploadZone.uploadPreview.expect.toHaveCount(1);
        await uploadZone.uploadPreview.errorMark.expect.toBeVisible();
        await uploadZone.uploadPreview.errorMessage.expect.toHaveText(
          `Размер файла (${ATTACHMENT_MAX_SIZE_IN_MB} МБ) больше чем максимальный размер (${ATTACHMENT_MAX_SIZE_IN_MB} МБ).`,
        );
      },
    );

    test(
      'S3. Вложения — Добавление MAX_COUNT файлов',
      {
        tag: ['@VCS-13160', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const filePaths = await Promise.all(
          Array.from({ length: ATTACHMENT_MAX_COUNT }, async () => {
            const { absolutePath } = await fileSystemService.generateBinaryFile(
              tempDir,
              getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
              generateValidAttachmentSize(dataGenerator),
            );
            return absolutePath;
          }),
        );

        const uploadZone = pullOverviewPage.timeline.commentForm.uploadZone;

        await uploadZone.message.expect.toBeVisible();
        const fileUuids: string[] = [];
        for (const filePath of filePaths) {
          const fileUuid = await uploadZone.waitForUpload(filePath);
          fileUuids.push(fileUuid);
        }
        expect(fileUuids).toHaveLength(ATTACHMENT_MAX_COUNT);

        await Promise.all(
          fileUuids.map((fileUuid) => {
            const fileKey = uploadKey(fileUuid);
            return s3Service.attachments.waitForExistence(fileKey);
          }),
        );
      },
    );

    test(
      'S3. Вложения — Добавление MAX_COUNT+1 файлов',
      {
        tag: ['@VCS-13163', Priority.NORMAL],
      },
      async ({ testContext, fileSystemService, dataGenerator, config }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const fileCount = ATTACHMENT_MAX_COUNT + 1;
        const tempDir = await fileSystemService.createTempDir();
        const filePaths = await Promise.all(
          Array.from({ length: fileCount }, async () => {
            const { absolutePath } = await fileSystemService.generateBinaryFile(
              tempDir,
              getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
              generateValidAttachmentSize(dataGenerator),
            );
            return absolutePath;
          }),
        );

        const uploadZone = pullOverviewPage.timeline.commentForm.uploadZone;

        await uploadZone.message.expect.toBeVisible();
        await uploadZone.chooseFiles(filePaths);

        for (let index = 0; index < fileCount - 1; index++) {
          const nthFile = uploadZone.uploadPreview.nth(index);
          await nthFile.softExpect.toContainClass(StatusClass.COMPLETE, { timeout: config.ui.responseTimeout });
          await nthFile.softExpect.toContainClass(StatusClass.SUCCESS);
        }

        const lastFile = uploadZone.uploadPreview.nth(fileCount - 1);
        await lastFile.softExpect.toContainClass(StatusClass.ERROR);
        await lastFile.errorMark.expect.toBeVisible();
        await lastFile.errorMessage.expect.toHaveText('You can not upload any more files.');
      },
    );

    test(
      'S3. Вложения — Дублирование вложения',
      {
        tag: ['@VCS-11634', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
          generateValidAttachmentSize(dataGenerator),
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const duplicateFileUuid = await commentForm.uploadZone.waitForUpload(absolutePath);
        const duplicateFileKey = uploadKey(duplicateFileUuid);
        await s3Service.attachments.waitForExistence(duplicateFileKey);
      },
    );

    test(
      'S3. Вложения — Перезапись вложения',
      {
        tag: ['@VCS-11633', Priority.NORMAL],
      },
      async ({ testContext, s3Service, fileSystemService, dataGenerator }) => {
        const { pullOverviewPage } = testContext as unknown as ThisTestContext;

        const tempDir = await fileSystemService.createTempDir();
        const filePaths = await Promise.all(
          Array.from({ length: 2 }, async () => {
            const { absolutePath } = await fileSystemService.generateBinaryFile(
              tempDir,
              getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS),
              generateValidAttachmentSize(dataGenerator),
            );
            return absolutePath;
          }),
        );

        const commentForm = pullOverviewPage.timeline.commentForm;

        await commentForm.uploadZone.message.expect.toBeVisible();
        const fileUuid = await commentForm.uploadZone.waitForUpload(filePaths[0]);

        const fileKey = uploadKey(fileUuid);
        await s3Service.attachments.waitForExistence(fileKey);

        const comment = pullOverviewPage.timeline.comment;
        await comment.startEdit();
        await comment.editForm.uploadZone.uploadPreview.remove.click();

        await comment.editForm.uploadZone.uploadPreview.expect.toHaveCount(0);

        const newFileUuid = await commentForm.uploadZone.waitForUpload(filePaths[1]);
        const newFileKey = uploadKey(newFileUuid);

        await comment.editForm.save.click();

        await s3Service.attachments.waitForAbsence(fileKey);
        await s3Service.attachments.waitForExistence(newFileKey);
      },
    );
  },
);
