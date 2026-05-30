import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';

import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { Endpoint } from '@vcs-pw/ui';
import { callNTimesWithDelay, extractFieldAndSort, sortByFields } from '@vcs-pw/utils/object.util';

const REPO_COUNT = 5;
const repoCreationDelay = () => 1000 + Math.floor(Math.random() * 1000);

test.describe(
  'Профиль проекта. Фильтр',
  {
    tag: [Layer.UI, '@project-filter'],
    annotation: [Annotation.OWNER('OUT-Pak.A.B')],
  },
  () => {
    test(
      'Профиль проекта. Отображение вкладки "Сортировка"',
      {
        tag: ['@VCS-10453', Priority.NORMAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, pageRegistry, authService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: false, auto_init: false });

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const projectProfile = new pageRegistry.project.profile(page);

        await projectProfile.goToEndpoint(Endpoint.PROJECT_PROFILE, {
          project: repoInfo.owner.name,
          repo: repoInfo.name,
        });

        await projectProfile.expectToBeOpened();

        await projectProfile.filterSort.click();
        await projectProfile.filterSortUpdated.softExpect.toBeVisible();
        await projectProfile.filterUpdatedLong.softExpect.toBeVisible();
        await projectProfile.filterByAlphabet.softExpect.toBeVisible();
        await projectProfile.filterByEndAlphabet.softExpect.toBeVisible();
        await projectProfile.filterPopular.softExpect.toBeVisible();
        await projectProfile.filterNoPopular.softExpect.toBeVisible();
        await projectProfile.filterMoreForks.softExpect.toBeVisible();
        await projectProfile.filterLessForks.softExpect.toBeVisible();
      },
    );

    test(
      'Профиль проекта. Корректная работа сортировки "По алфавиту"',
      {
        tag: ['@VCS-13748', Priority.NORMAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, pageRegistry, authService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const repoPromises = Array.from({ length: REPO_COUNT }, () => entityManager.createRepoV3(projectOptions));
        const repos = await Promise.all(repoPromises);

        const expectedSortedRepoNames = extractFieldAndSort(repos, 'name');

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const projectProfile = new pageRegistry.project.profile(page);

        await projectProfile.goToEndpoint(Endpoint.PROJECT_PROFILE, {
          project: projectInfo.name,
        });

        await projectProfile.expectToBeOpened();
        await projectProfile.filterSort.click();
        await projectProfile.filterByAlphabet.click();

        const repoItems = projectProfile.repoCard;
        await repoItems.softExpect.toHaveCount(REPO_COUNT);

        await repoItems.title.expect.toHaveText(expectedSortedRepoNames);
      },
    );

    test(
      'Профиль проекта. Корректная работа сортировки "С конца алфавита"',
      {
        tag: ['@VCS-14122', Priority.NORMAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, pageRegistry, authService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const repoPromises = Array.from({ length: REPO_COUNT }, () => entityManager.createRepoV3(projectOptions));
        const repos = await Promise.all(repoPromises);

        const expectedSortedRepoNames = extractFieldAndSort(repos, 'name', true);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const projectProfile = new pageRegistry.project.profile(page);

        await projectProfile.goToEndpoint(Endpoint.PROJECT_PROFILE, {
          project: projectInfo.name,
        });

        await projectProfile.expectToBeOpened();
        await projectProfile.filterSort.click();
        await projectProfile.filterByEndAlphabet.click();

        const repoItems = projectProfile.repoCard;
        await repoItems.softExpect.toHaveCount(REPO_COUNT);

        await repoItems.title.expect.toHaveText(expectedSortedRepoNames);
      },
    );

    test(
      'Профиль проекта. Корректная работа сортировки "Недавно обновленные"',
      {
        tag: ['@VCS-13215', Priority.NORMAL],
      },
      async ({ user, tenantInfo, entityManager, privilegeService, pageRegistry, authService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const repos = await callNTimesWithDelay(
          () => entityManager.createRepoV3(projectOptions),
          REPO_COUNT,
          repoCreationDelay,
        );
        const sortedRepos = sortByFields(repos, ['updated_at:desc']);
        const expectedRepoNames = sortedRepos.map((repo) => repo.name);

        const context = await authService.createAuthenticatedSession(user);
        const page = await context.newPage();
        const projectProfile = new pageRegistry.project.profile(page);

        await projectProfile.goToEndpoint(Endpoint.PROJECT_PROFILE, {
          project: projectInfo.name,
        });

        await projectProfile.expectToBeOpened();
        await projectProfile.filterSort.expect.toBeVisible();
        await projectProfile.filterSortUpdated.expect.toBeVisible();

        const repoItems = projectProfile.repoCard;
        await repoItems.softExpect.toHaveCount(REPO_COUNT);

        await repoItems.title.expect.toHaveText(expectedRepoNames);
      },
    );
  },
);
