import { zMultiFileUploadResponse } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { RepoOptions as RepoOptionsV3 } from '@vcs-pw/api/v3';
import { RepoOptions } from '@vcs-pw/api/web';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { ATTACHMENT_ALLOWED_EXTENSIONS, generateValidAttachmentSize } from '@vcs-pw/types/sc-settings.type';
import { basename } from '@vcs-pw/utils/file.util';
import { getRandomElement } from '@vcs-pw/utils/object.util';

const toPath = ({ projectName, repoName }: RepoOptions) => `/web/v2/repos/${projectName}/${repoName}/attachments`;

const FIELD_NAME = 'files';

interface ThisTestContext {
  repoOptions: RepoOptionsV3;
}

test.describe(
  'POST /web/v2/repos/:owner/:repo/attachments',
  {
    tag: [Layer.API, '@web', '@v2', '@upload-attachments'],
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
      });
    });

    test(
      `POST /web/v2/repos/:owner/:repo/attachments — 207 Multi-Status — Загрузка вложения репозитория`,
      {
        tag: ['@VCS-14052', Priority.CRITICAL],
      },
      async ({ user, testContext, apiRegistry, authService, privilegeService, fileSystemService, dataGenerator }) => {
        const { repoOptions } = testContext as unknown as ThisTestContext;
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READ_CREATE);

        const tempDir = await fileSystemService.createTempDir();

        const fileCount = dataGenerator.faker.number.int({ min: 1, max: 3 });

        const files = await Promise.all(
          Array.from({ length: fileCount }, async () => {
            const extension = getRandomElement(ATTACHMENT_ALLOWED_EXTENSIONS);
            return await fileSystemService.generateBinaryFile(
              tempDir,
              extension,
              generateValidAttachmentSize(dataGenerator),
            );
          }),
        );

        const formData = new FormData();
        for (const file of files) {
          const buffer = Buffer.from(file.content);
          formData.append(FIELD_NAME, new Blob([buffer]), file.relativePath);
        }

        const context = await authService.createAuthenticatedSession(user);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.post(path, {
          multipart: formData,
        });

        const expectedFileData = files.map((file) => ({
          data: {
            content_type: 'application/octet-stream',
            size: file.content.length,
            upload_uid: expect.uuid(),
            url: expect.stringContaining('attachments'),
          },
          filename: basename(file.relativePath),
          status: 'success',
        }));

        await HttpResponseAssertions.multiStatus(response, {
          data: {
            results: expect.arrayContaining(expectedFileData),
            summary: { failed: 0, success: fileCount, total: fileCount },
          },
          zodSchema: zMultiFileUploadResponse,
          xRequestIdHeader: false,
        });
      },
    );
  },
);
