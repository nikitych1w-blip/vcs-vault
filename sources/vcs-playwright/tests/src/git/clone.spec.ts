import { test, expect } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

test.describe(
  'Git',
  {
    tag: [Layer.API, '@git'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'Git Clone — SSH — Клонирование приватного репозитория с привилегией "read"',
      {
        tag: ['@VCS-3950', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, gitService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const sshPair = await entityManager.generateAndAddSshKey(user.loginName!);
        const git = await gitService.getConfiguredGit(user, sshPair.privateKeyPath);

        const cloneResult = await git.clone(repoInfo.links.ssh);
        expect(cloneResult).toBeOk();
      },
    );

    test(
      'Git Clone — HTTP — Клонирование приватного репозитория с привилегией "read"',
      {
        tag: ['@VCS-3947', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, gitService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const git = await gitService.getConfiguredGit(user);

        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();
      },
    );
  },
);
