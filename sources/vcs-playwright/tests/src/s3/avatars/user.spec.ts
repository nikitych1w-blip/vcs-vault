import { ImageFormat } from '@vcs-pw/services/image.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { Endpoint } from '@vcs-pw/ui';
import { delay } from '@vcs-pw/utils/object.util';
import { avatarKey, AvatarType } from '@vcs-pw/utils/s3.util';

const MAX_WIDTH = 4096;
const MAX_HEIGHT = 4096;
const MAX_FILE_SIZE = 2 ** 20; // 1 МБ
const MAX_ORIGIN_SIZE = 256 * 2 ** 10 - 1; // 256 КБ => в этом случае не делается crop (не включительно, поэтому вычитаем 1)
const DEFAULT_IMAGE_FORMAT = ImageFormat.PNG;

test.describe(
  'S3. Аватары. Пользователь',
  {
    tag: [Layer.UI, '@s3', '@avatars', '@user-avatar'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    // В тестах используются УЗ из ограниченного пула. Могут аффектить друг друга, поэтому идем последовательно
    test.describe.configure({ mode: 'default' });

    test.beforeAll('Бакет существует', async ({ s3Service }) => {
      const isBucketExists = await s3Service.isBucketExists();
      expect(isBucketExists).toBe(true);
    });

    Object.values(ImageFormat).forEach((format) => {
      test(
        `S3. Аватары. Пользователь — Обновление аватара (${format.name})`,
        {
          tag: ['@VCS-11610', Priority.NORMAL],
        },
        async ({ user, pageRegistry, authService, s3Service, imageService }) => {
          const context = await authService.createAuthenticatedSession(user);
          const page = await context.newPage();
          const userSettingsPage = new pageRegistry.user.settings(page);

          await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
          await userSettingsPage.expectToBeOpened();

          const image = await imageService.generate({
            maxSize: MAX_ORIGIN_SIZE,
            format,
          });

          await userSettingsPage.profileTab.uploadAvatarForm.uploadAvatar(image, format);

          const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
          await s3Service.avatars.waitForExistence(userAvatarKey);
        },
      );
    });

    test(
      `S3. Аватары. Пользователь — Удаление аватара`,
      {
        tag: ['@VCS-11611', Priority.NORMAL],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          maxSize: MAX_ORIGIN_SIZE,
          format,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForExistence(userAvatarKey);

        await userSettingsPage.flashSuccess.expect.toBeVisible();

        await uploadAvatarForm.deleteAvatar();
        await s3Service.avatars.waitForAbsence(userAvatarKey);
      },
    );

    test(
      `S3. Аватары. Пользователь — Повторная загрузка аватара`,
      {
        tag: ['@VCS-11609', Priority.MINOR],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          maxSize: MAX_FILE_SIZE,
          format,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        await userSettingsPage.flashSuccess.expect.toBeVisible();

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForExistence(userAvatarKey);

        const avatarInfo = await s3Service.avatars.get(userAvatarKey);
        expect(avatarInfo.LastModified).toBeDefined();

        await delay(1000); // Зло, но тест проходит очень быстро, что нет изменений в lastModified
        await uploadAvatarForm.uploadAvatar(image, format);

        const newAvatarInfo = await s3Service.avatars.get(userAvatarKey);
        expect(newAvatarInfo.LastModified!.getTime()).not.toBe(avatarInfo.LastModified?.getTime());
      },
    );

    test(
      `S3. Аватары. Пользователь — Превышен размер MAX_SIZE`,
      {
        tag: ['@VCS-12609', Priority.MINOR],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          maxSize: MAX_FILE_SIZE + 2 ** 10,
          format,
          exactSize: true,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const error = userSettingsPage.flashError;
        await error.expect.toContainText('Загруженный файл превысил максимальный размер');

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForAbsence(userAvatarKey);
      },
    );

    test(
      `S3. Аватары. Пользователь — Превышена высота изображения AVATAR_MAX_HEIGHT`,
      {
        tag: ['@VCS-13665', Priority.MINOR],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          height: MAX_HEIGHT + 1,
          maxSize: MAX_FILE_SIZE,
          format,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const error = userSettingsPage.flashError;
        await error.expect.toContainText('image height is too large');

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForAbsence(userAvatarKey);
      },
    );

    test(
      `S3. Аватары. Пользователь — Превышена ширина изображения AVATAR_MAX_WIDTH`,
      {
        tag: ['@VCS-13666', Priority.MINOR],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = DEFAULT_IMAGE_FORMAT;
        const image = await imageService.generate({
          width: MAX_WIDTH + 1,
          maxSize: MAX_FILE_SIZE,
          format,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const error = userSettingsPage.flashError;
        await error.expect.toContainText('image width is too large');

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForAbsence(userAvatarKey);
      },
    );

    test(
      `S3. Аватары. Пользователь — Отправка изображения размером MAX_ORIGIN_SIZE`,
      {
        tag: ['@VCS-13667', Priority.MINOR],
      },
      async ({ user, pageRegistry, authService, s3Service, imageService }) => {
        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const userSettingsPage = new pageRegistry.user.settings(page);

        await userSettingsPage.goToEndpoint(Endpoint.USER_SETTING);
        await userSettingsPage.expectToBeOpened();

        const format = ImageFormat.WEBP;
        const image = await imageService.generate({
          height: Math.floor(MAX_HEIGHT / 10),
          width: Math.floor(MAX_WIDTH / 10),
          maxSize: MAX_FILE_SIZE,
          format,
          exactSize: true,
        });

        const uploadAvatarForm = userSettingsPage.profileTab.uploadAvatarForm;
        await uploadAvatarForm.uploadAvatar(image, format);

        const userAvatarKey = avatarKey(user.id!, AvatarType.USER, image);
        await s3Service.avatars.waitForExistence(userAvatarKey);

        const avatarInfo = await s3Service.avatars.get(userAvatarKey);
        expect(avatarInfo.ContentLength).toBe(image.length);
      },
    );
  },
);
