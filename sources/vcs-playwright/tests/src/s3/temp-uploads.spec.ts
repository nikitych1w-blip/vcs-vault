import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import {
  generateValidUploadSize,
  UPLOAD_ALLOWED_EXTENSIONS,
  UPLOAD_MAX_COUNT,
  UPLOAD_MAX_SIZE,
  UPLOAD_MAX_SIZE_IN_MB,
} from '@vcs-pw/types/sc-settings.type';
import { Endpoint } from '@vcs-pw/ui';
import { StatusClass } from '@vcs-pw/ui/components/repo/upload-preview.component';
import { getRandomElement } from '@vcs-pw/utils/object.util';
import { uploadKey } from '@vcs-pw/utils/s3.util';

interface ThisTestContext {
  repoInfo: RepositoryV3ZodType;
}

test.describe(
  'S3. Временные файлы',
  {
    tag: [Layer.UI, '@s3', '@temp-upload'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Бакет существует', async ({ s3Service }) => {
      const isBucketExists = await s3Service.isBucketExists();
      expect(isBucketExists).toBe(true);
    });

    test.beforeEach(
      'Создание репозитория',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: false });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);
        await privilegeService.waitForRepoPrivilege(repoOptions, user.name, PrivilegeGroup.WRITER);

        testContext.put({ repoInfo });
      },
    );

    test(
      'S3. Временные файлы — Не удаляется файл в бакете при отмене добавления файла (через кнопку в форме создания коммита)',
      {
        tag: ['@VCS-12581', Priority.MINOR],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService, dataGenerator }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          generateValidUploadSize(dataGenerator),
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        await repoUploadFilePage.commitForm.cancel.click();

        const repoCodeBranchPage = new pageRegistry.repo.code.branchQuickStart(page);
        await repoCodeBranchPage.expectToBeOpened();

        await s3Service.tempUploads.waitForExistence(fileKey);
      },
    );

    test(
      'S3. Временные файлы — Не удаляется файл в бакете при отмене добавления файла (через кнопку в хлебных крошках)',
      {
        tag: ['@VCS-13085', Priority.MINOR],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService, dataGenerator }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          generateValidUploadSize(dataGenerator),
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        await repoUploadFilePage.breadcrumbCancel.click();

        const repoCodeBranchPage = new pageRegistry.repo.code.branchQuickStart(page);
        await repoCodeBranchPage.expectToBeOpened();

        await s3Service.tempUploads.waitForExistence(fileKey);
      },
    );

    test(
      'S3. Временные файлы — Создании коммита',
      {
        tag: ['@VCS-13074', Priority.CRITICAL],
        annotation: [
          Annotation.DESCRIPTION('Данные корректно сохраняются в файл при коммите, файл в бакете удаляется'),
        ],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService, dataGenerator }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const fileName = `${dataGenerator.faker.system.fileName()}${getRandomElement(UPLOAD_ALLOWED_EXTENSIONS)}`;
        const fileContent = dataGenerator.faker.lorem.paragraphs(20);
        const absolutePath = await fileSystemService.createOrOverrideFile(fileName, tempDir, fileContent);

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        await repoUploadFilePage.uploadZone.uploadPreview.softExpect.toHaveCount(1);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        await repoUploadFilePage.commitForm.submit.click();

        const repoCodeBranchPage = new pageRegistry.repo.code.branch(page);
        await repoCodeBranchPage.expectToBeOpened();

        await repoCodeBranchPage.fileName.softExpect.toHaveText(fileName);
        await repoCodeBranchPage.fileName.click();

        const repoViewFilePage = new pageRegistry.repo.code.viewFile(page);
        await repoViewFilePage.expectToBeOpened();

        const newTab = await repoViewFilePage.openRaw();

        const repoRawFilePage = new pageRegistry.repo.code.rawFile(newTab);
        await repoRawFilePage.expectToBeOpened();

        await repoRawFilePage.raw.softExpect.toHaveText(fileContent);

        await s3Service.tempUploads.waitForAbsence(fileKey);
      },
    );

    test(
      'S3. Временные файлы — Добавление файла размером 0 байт',
      {
        tag: ['@VCS-13073', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          0,
        );
        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        const fileInfo = await s3Service.tempUploads.get(fileKey);
        const s3FileContent = await fileInfo.Body?.transformToByteArray();
        expect(s3FileContent).toHaveLength(0);
      },
    );

    test(
      'S3. Временные файлы — Добавление файла размером MAX_SIZE',
      {
        tag: ['@VCS-12610', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath, content } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          UPLOAD_MAX_SIZE,
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        const fileInfo = await s3Service.tempUploads.get(fileKey);
        const s3FileContent = await fileInfo.Body?.transformToString();
        expect(s3FileContent).toBe(content);
      },
    );

    test(
      'S3. Временные файлы — Добавление MAX_COUNT файлов',
      {
        tag: ['@VCS-13072', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService, dataGenerator }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const filePaths = await Promise.all(
          Array.from({ length: UPLOAD_MAX_COUNT }, async () => {
            const { absolutePath } = await fileSystemService.generateBinaryFile(
              tempDir,
              getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
              generateValidUploadSize(dataGenerator),
            );
            return absolutePath;
          }),
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuids: string[] = [];
        for (const filePath of filePaths) {
          const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(filePath);
          fileUuids.push(fileUuid);
        }
        expect(fileUuids).toHaveLength(UPLOAD_MAX_COUNT);

        await Promise.all(
          fileUuids.map((fileUuid) => {
            const fileKey = uploadKey(fileUuid);
            return s3Service.tempUploads.waitForExistence(fileKey);
          }),
        );
      },
    );

    test(
      'S3. Временные файлы — Добавление файла размером MAX_SIZE+1',
      {
        tag: ['@VCS-13087', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, fileSystemService }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          UPLOAD_MAX_SIZE + 1,
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        await repoUploadFilePage.uploadZone.chooseFiles([absolutePath]);

        await repoUploadFilePage.uploadZone.uploadPreview.expect.toHaveCount(1);
        await repoUploadFilePage.uploadZone.uploadPreview.errorMark.expect.toBeVisible();
        await repoUploadFilePage.uploadZone.uploadPreview.errorMessage.expect.toHaveText(
          `Размер файла (${UPLOAD_MAX_SIZE_IN_MB} МБ) больше чем максимальный размер (${UPLOAD_MAX_SIZE_IN_MB} МБ).`,
        );
      },
    );

    test(
      'S3. Временные файлы — Добавление MAX_COUNT+1 файлов',
      {
        tag: ['@VCS-13088', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, fileSystemService, dataGenerator, config }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const fileCount = UPLOAD_MAX_COUNT + 1;
        const tempDir = await fileSystemService.createTempDir();
        const filePaths = await Promise.all(
          Array.from({ length: fileCount }, async () => {
            const { absolutePath } = await fileSystemService.generateBinaryFile(
              tempDir,
              getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
              generateValidUploadSize(dataGenerator),
            );
            return absolutePath;
          }),
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        await repoUploadFilePage.uploadZone.chooseFiles(filePaths);

        for (let index = 0; index < fileCount - 1; index++) {
          const nthFile = repoUploadFilePage.uploadZone.uploadPreview.nth(index);
          await nthFile.softExpect.toContainClass(StatusClass.COMPLETE, { timeout: config.ui.responseTimeout });
          await nthFile.softExpect.toContainClass(StatusClass.SUCCESS);
        }

        const lastFile = repoUploadFilePage.uploadZone.uploadPreview.nth(fileCount - 1);
        await lastFile.softExpect.toContainClass(StatusClass.ERROR);
        await lastFile.errorMark.expect.toBeVisible();
        await lastFile.errorMessage.expect.toHaveText('You can not upload any more files.');
      },
    );

    test(
      'S3. Временные файлы — Удаляется файл в бакете при отмене добавления файла через кнопку в превью',
      {
        tag: ['@VCS-13090', Priority.NORMAL],
      },
      async ({ user, testContext, pageRegistry, authService, s3Service, fileSystemService, dataGenerator }) => {
        const { repoInfo } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoUploadFilePage = new pageRegistry.repo.upload(page);

        await repoUploadFilePage.goToEndpoint(Endpoint.REPOSITORY_UPLOAD_FILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
          branch: repoInfo.default_branch,
        });
        await repoUploadFilePage.expectToBeOpened();

        const tempDir = await fileSystemService.createTempDir();
        const { absolutePath } = await fileSystemService.generateBinaryFile(
          tempDir,
          getRandomElement(UPLOAD_ALLOWED_EXTENSIONS),
          generateValidUploadSize(dataGenerator),
        );

        await repoUploadFilePage.uploadZone.message.expect.toBeVisible();
        const fileUuid = await repoUploadFilePage.uploadZone.waitForUpload(absolutePath);

        const fileKey = uploadKey(fileUuid);
        await s3Service.tempUploads.waitForExistence(fileKey);

        await repoUploadFilePage.uploadZone.uploadPreview.expect.toHaveCount(1);

        await repoUploadFilePage.uploadZone.uploadPreview.remove.click();
        await repoUploadFilePage.uploadZone.uploadPreview.expect.toHaveCount(0);

        await s3Service.tempUploads.waitForAbsence(fileKey);
      },
    );
  },
);
