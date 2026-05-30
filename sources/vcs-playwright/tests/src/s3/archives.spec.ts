import { ProjectInfo } from '@vcs-pw/api/v2/projects/projects.api';
import { RepoInfo } from '@vcs-pw/api/v2/projects/repos.api';
import { ArchiveFormat } from '@vcs-pw/api/v3/repos/archive.api';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { archiveKey } from '@vcs-pw/utils/s3.util';

interface ThisTestContext {
  projectInfo: ProjectInfo;
  repoInfo: RepoInfo;
  sha: string;
}

test.describe(
  'S3. Архивы',
  {
    tag: [Layer.API, '@s3', '@archives'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll('Бакет существует', async ({ s3Service }) => {
      const isBucketExists = await s3Service.isBucketExists();
      expect(isBucketExists).toBe(true);
    });

    test.beforeEach(
      'Создание репозитория с коммитом',
      async ({ tenantInfo, entityManager, privilegeService, user, testContext, apiRegistry, gitService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };

        const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions); // Так как нужен id repo, в api v3 его нет

        const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };
        await privilegeService.grantToProject(repoOptions, user.name, PrivilegeGroup.MANAGER);
        await privilegeService.waitForProjectPrivilege(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
        const repoInfoV3 = await reposApi.getRepo(repoOptions);

        const git = await gitService.getConfiguredGit(user);

        const initResult = await git.init(repoInfo.default_branch);
        expect(initResult).toBeOk();

        const addRemoteResult = await git.addRemote(repoInfoV3.links.clone);
        expect(addRemoteResult).toBeOk();

        const generateCommitResult = await git.generateCommitsAndPush(1);
        expect(generateCommitResult).toBeOk();

        const defaultShaResult = await git.getShaByRef(repoInfo.default_branch);
        expect(defaultShaResult).toBeOk();
        const sha = defaultShaResult.result!;

        testContext.put({ projectInfo, repoInfo, sha });
      },
    );

    [
      {
        tag: '@VCS-13257',
        format: ArchiveFormat.TAR_GZ,
      },
      {
        tag: '@VCS-13258',
        format: ArchiveFormat.ZIP,
      },
    ].forEach(({ tag, format }) => {
      test(
        `S3. Архивы — Скачивание архива через API v3 не генерирует файл в S3 (${format})`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, tenantInfo, testContext, apiRegistry, s3Service }) => {
          const { repoInfo, projectInfo, sha } = testContext as unknown as ThisTestContext;

          const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const archiveApi = apiRegistry.v3.repos.archive.withBasic(user);
          await archiveApi.getArchiveAsStream(repoOptions, { sha, format }, () => {
            /* empty */
          });

          const repoArchiveKey = archiveKey(repoInfo.id, sha, format);
          await s3Service.repoArchives.waitForAbsence(repoArchiveKey);
        },
      );
    });

    [
      {
        tag: '@VCS-12587',
        format: ArchiveFormat.TAR_GZ,
      },
      {
        tag: '@VCS-11607',
        format: ArchiveFormat.ZIP,
      },
    ].forEach(({ tag, format }) => {
      test(
        `S3. Архивы — Успешная загрузка архива с новым SHA (${format})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, tenantInfo, testContext, apiRegistry, s3Service, authService }) => {
          const { repoInfo, projectInfo, sha } = testContext as unknown as ThisTestContext;

          const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const context = await authService.createAuthenticatedSession(user);
          const archiveApi = apiRegistry.web.v1.repo.archive.withRequest(context.request);

          await archiveApi.getArchive(repoOptions, repoInfo.default_branch, format);

          const repoArchiveKey = archiveKey(repoInfo.id, sha, format);
          await s3Service.repoArchives.waitForExistence(repoArchiveKey);
        },
      );
    });

    [
      {
        tag: '@VCS-12588',
        format: ArchiveFormat.TAR_GZ,
      },
      {
        tag: '@VCS-12589',
        format: ArchiveFormat.ZIP,
      },
    ].forEach(({ tag, format }) => {
      test(
        `S3. Архивы — Повторная загрузка архива с тем же SHA (${format})`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, tenantInfo, testContext, apiRegistry, s3Service, authService }) => {
          const { repoInfo, projectInfo, sha } = testContext as unknown as ThisTestContext;

          const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const context = await authService.createAuthenticatedSession(user);
          const archiveApi = apiRegistry.web.v1.repo.archive.withRequest(context.request);

          await archiveApi.getArchive(repoOptions, repoInfo.default_branch, format);

          const repoArchiveKey = archiveKey(repoInfo.id, sha, format);
          await s3Service.repoArchives.waitForExistence(repoArchiveKey);

          const archiveInfo = await s3Service.repoArchives.get(repoArchiveKey);
          expect(archiveInfo.LastModified).toBeDefined();

          await archiveApi.getArchive(repoOptions, repoInfo.default_branch, format);
          await s3Service.repoArchives.waitForExistence(repoArchiveKey);

          const newArchiveInfo = await s3Service.repoArchives.get(repoArchiveKey);
          expect(newArchiveInfo.LastModified?.getTime()).toBe(archiveInfo.LastModified?.getTime());
        },
      );
    });

    [
      {
        tag: '@VCS-12590',
        format: ArchiveFormat.TAR_GZ,
      },
      {
        tag: '@VCS-11627',
        format: ArchiveFormat.ZIP,
      },
    ].forEach(({ tag, format }) => {
      test(
        `S3. Архивы — Удаление архива в S3 при удалении репозитория (${format})`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ user, tenantInfo, testContext, apiRegistry, s3Service, authService }) => {
          const { repoInfo, projectInfo, sha } = testContext as unknown as ThisTestContext;

          const repoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const context = await authService.createAuthenticatedSession(user);
          const archiveApi = apiRegistry.web.v1.repo.archive.withRequest(context.request);

          await archiveApi.getArchive(repoOptions, repoInfo.default_branch, format);

          const repoArchiveKey = archiveKey(repoInfo.id, sha, format);
          await s3Service.repoArchives.waitForExistence(repoArchiveKey);

          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
          await reposApi.deleteRepo(repoOptions);

          await s3Service.repoArchives.waitForAbsence(repoArchiveKey);
        },
      );
    });
  },
);
