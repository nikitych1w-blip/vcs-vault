import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { Endpoint } from '@vcs-pw/ui';

test.describe(
  'Репозиторий. Настройки. Защита веток',
  {
    tag: [Layer.UI, '@branch-protections'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      'Отображение раздела "Ветки" для неинициализированного репозитория',
      {
        tag: ['@VCS-5167', Priority.NORMAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, pageRegistry, authService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: false });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.MANAGER);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const repoSettingsPage = new pageRegistry.repo.settings(page);

        await repoSettingsPage.goToEndpoint(Endpoint.REPOSITORY_SETTINGS, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
        });
        await repoSettingsPage.expectToBeOpened();
        await repoSettingsPage.menu.item.expect.toHaveTextInAnyElement('Ветки');
      },
    );
  },
);
