import { ImageFormat } from '@vcs-pw/services/image.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { Endpoint } from '@vcs-pw/ui';
import { avatarKey, AvatarType } from '@vcs-pw/utils/s3.util';

const MAX_ORIGIN_SIZE = 256 * 2 ** 10 - 1; // 256 КБ => в этом случае не делается crop (не включительно, поэтому вычитаем 1)
const DEFAULT_IMAGE_FORMAT = ImageFormat.PNG;

interface ThisTestContext {
  repoId: number;
  repoName: string;
  projectName: string;
}

test.describe(
  'S3. Аватары. Репозиторий',
  {
    tag: [Layer.UI, '@s3', '@avatars', '@repo-avatar'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Бакет существует', async ({ s3Service }) => {
      const isBucketExists = await s3Service.isBucketExists();
      expect(isBucketExists).toBe(true);
    });

    test.beforeEach(
      'Создание репозитория',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext, apiRegistry }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToProject(repoOptions, user.name, PrivilegeGroup.MANAGER);
        await privilegeService.waitForProjectPrivilege(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const reposApi = apiRegistry.v1.repos.repos.withBasic(user);
        const repoInfoV1 = await reposApi.getRepo(repoOptions);

        testContext.put({ repoId: repoInfoV1.id, repoName: repoInfo.name, projectName: projectInfo.name });
      },
    );

    Object.values(ImageFormat).forEach((format) => {
      test(
        `S3. Аватары. Репозиторий — Установка аватара (${format.name})`,
        {
          tag: ['@VCS-12605', Priority.NORMAL],
        },
        async ({ user, pageRegistry, authService, s3Service, imageService, testContext }) => {
          const { repoId, repoName, projectName } = testContext as unknown as ThisTestContext;

          const context = await authService.createAuthenticatedSession(user);
          const page = await context.newPage();
          const repoSettingsPage = new pageRegistry.repo.settings(page);

          await repoSettingsPage.goToEndpoint(Endpoint.REPOSITORY_SETTINGS, { repo: repoName, project: projectName });
          await repoSettingsPage.expectToBeOpened();

          const image = await imageService.generate({
            maxSize: MAX_ORIGIN_SIZE,
            format,
          });

          await repoSettingsPage.repositoryTab.uploadAvatarForm.uploadAvatar(image, format);

          const repoAvatarKey = avatarKey(repoId, AvatarType.REPO, image);
          await s3Service.avatars.waitForExistence(repoAvatarKey);
        },
      );
    });

    test(
      `S3. Аватары. Репозиторий — Удаление аватара`,
      {
        tag: ['@VCS-12607', Priority.NORMAL],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService, testContext }) => {
        const { repoId, repoName, projectName } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoSettingsPage = new pageRegistry.repo.settings(page);

        await repoSettingsPage.goToEndpoint(Endpoint.REPOSITORY_SETTINGS, { repo: repoName, project: projectName });
        await repoSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          maxSize: MAX_ORIGIN_SIZE,
          format,
        });

        const uploadAvatarForm = repoSettingsPage.repositoryTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const repoAvatarKey = avatarKey(repoId, AvatarType.REPO, image);
        await s3Service.avatars.waitForExistence(repoAvatarKey);

        await repoSettingsPage.flashSuccess.expect.toBeVisible();

        await uploadAvatarForm.deleteAvatar();
        await s3Service.avatars.waitForAbsence(repoAvatarKey);
      },
    );

    test(
      `S3. Аватары. Репозиторий — Обновление аватара другим пользователем`,
      {
        tag: ['@VCS-12608', Priority.MINOR],
      },
      async ({
        user,
        tenantInfo,
        userPool,
        pageRegistry,
        authService,
        s3Service,
        imageService,
        testContext,
        privilegeService,
      }) => {
        const { repoId, repoName, projectName } = testContext as unknown as ThisTestContext;

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        let repoSettingsPage = new pageRegistry.repo.settings(page);

        await repoSettingsPage.goToEndpoint(Endpoint.REPOSITORY_SETTINGS, { repo: repoName, project: projectName });
        await repoSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          maxSize: MAX_ORIGIN_SIZE,
          format,
        });

        let uploadAvatarForm = repoSettingsPage.repositoryTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const repoAvatarKey = avatarKey(repoId, AvatarType.REPO, image);
        await s3Service.avatars.waitForExistence(repoAvatarKey);

        // Действия второго пользователя
        const secondUser = userPool.get();
        await privilegeService.grantToRepo(
          { tenantId: tenantInfo.id, projectName, repoName },
          secondUser.name,
          PrivilegeGroup.MANAGER,
        );

        const secondContext = await authService.createAuthenticatedSession(secondUser);
        const secondPage = await secondContext.newPage();
        repoSettingsPage = new pageRegistry.repo.settings(secondPage);

        await repoSettingsPage.goToEndpoint(Endpoint.REPOSITORY_SETTINGS, { repo: repoName, project: projectName });
        await repoSettingsPage.expectToBeOpened();

        const newImage = await imageService.generate({
          maxSize: MAX_ORIGIN_SIZE,
          format,
        });

        uploadAvatarForm = repoSettingsPage.repositoryTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(newImage, format);

        const repoNewAvatarKey = avatarKey(repoId, AvatarType.REPO, newImage);
        await s3Service.avatars.waitForExistence(repoNewAvatarKey);
        await s3Service.avatars.waitForAbsence(repoAvatarKey);
      },
    );
  },
);
