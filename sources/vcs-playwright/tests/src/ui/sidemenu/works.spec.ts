import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { Endpoint } from '@vcs-pw/ui';

test.describe(
  'OneWork',
  {
    tag: [Layer.UI, '@ow'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test.beforeAll(({ config }) => {
      test.skip(!config.ow, 'Отсутствует интеграция с OneWork');
    });

    test(
      'Создание проекта и выдача группы привилегий на проект',
      {
        tag: ['@VCS-10532', Priority.CRITICAL],
      },
      async ({
        user,
        tenantInfo,
        pageRegistry,
        authService,
        entityManager,
        privilegeService,
        owCoordinatorRequest,
      }) => {
        const projectInfo = await entityManager.createOneWorkProject(owCoordinatorRequest, tenantInfo.tenant_key);

        const privilegeGroup = PrivilegeGroup.READER;
        await privilegeService.grantToOneWorkProject(
          owCoordinatorRequest,
          {
            tenantKey: tenantInfo.tenant_key,
            projectKey: projectInfo.projectKey,
          },
          user.email!,
          privilegeGroup,
        );

        await privilegeService.waitForProjectPrivilege(
          {
            tenantId: tenantInfo.id,
            projectName: projectInfo.projectName,
          },
          user.name,
          privilegeGroup,
        );

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const projectProfilePage = new pageRegistry.project.profile(page);

        await projectProfilePage.goToEndpoint(Endpoint.PROJECT_PROFILE, {
          project: projectInfo.projectName,
        });
        await projectProfilePage.expectToBeOpened();
        await projectProfilePage.sideMenu.expect.toBeVisible();
        await projectProfilePage.sideMenu.body.rootLevelOptions.item.expect.toHaveTextInAnyElement('Дашборд');
      },
    );
  },
);
