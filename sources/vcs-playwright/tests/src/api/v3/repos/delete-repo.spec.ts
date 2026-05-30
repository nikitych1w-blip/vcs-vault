import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ tenantId, projectName, repoName }: RepoOptions) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}`;

test.describe(
  'DELETE /api/v3/repos/:tenant/:owner/:repo',
  {
    tag: [Layer.API, '@v3', '@repos', '@delete-repo'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    [
      { title: 'Удаление инициализированного репозитория', autoInit: true },
      { title: 'Удаление неинициализированного репозитория', autoInit: false },
    ].forEach(({ title, autoInit }) => {
      test(
        `DELETE /api/v3/repos/:tenant/:owner/:repo — 204 No Content — ${title}`,
        {
          tag: ['@VCS-9719', Priority.CRITICAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

          const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: autoInit });

          const repoOptions = { ...projectOptions, repoName: repoInfo.name };
          const path = toPath(repoOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.delete(path);

          await HttpResponseAssertions.noContent(response, {
            data: '',
          });

          await step('Репозиторий не существует', async () => {
            const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
            const isExist = await reposApi.isExist(repoOptions);
            expect(isExist).toBeFalsy();
          });
        },
      );
    });

    [
      {
        title: 'Заголовок Authorization отсутствует',
        generateAuthHeader: (_: DataGenerator) => {
          return {};
        },
      },
      {
        title: 'Заголовок Authorization имеет пустое значение',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: '' };
        },
      },
      {
        title: 'Заголовок Authorization имеет невалидный token',
        generateAuthHeader: (dg: DataGenerator) => {
          return { Authorization: `token ${dg.faker.string.alphanumeric(40)}` };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `DELETE /api/v3/repos/:tenant/:owner/:repo — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9720', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.delete(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorized(response);
        },
      );
    });

    [
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      // Вынесены случаи в отдельный тест, поскольку объект ошибки возвращается старого формата
      test(
        `DELETE /api/v3/repos/:tenant/:owner/:repo — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9720', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.delete(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии delete',
      {
        tag: ['@VCS-9721', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG,
          instance: path,
        });

        await step('Репозиторий существует', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);

          const isExist = await reposApi.isExist(repoOptions);
          expect(isExist).toBeTruthy();
        });
      },
    );

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии delete с токеном со скоупом delete_repo',
      {
        tag: ['@VCS-9722', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const token = await entityManager.createAccessTokenV1(user.name, ['delete_repo']);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG,
          instance: path,
        });

        await step('Репозиторий существует', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);

          const isExist = await reposApi.isExist(repoOptions);
          expect(isExist).toBeTruthy();
        });
      },
    );

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа delete_repo',
      {
        tag: ['@VCS-9723', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const token = await entityManager.createAccessTokenV1(user.name, []);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: delete_repo');

        await step('Репозиторий существует', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);

          const isExist = await reposApi.isExist(repoOptions);
          expect(isExist).toBeTruthy();
        });
      },
    );

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 204 No Content — Выполнение запроса с токеном со скоупом delete_repo',
      {
        tag: ['@VCS-9724', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const token = await entityManager.createAccessTokenV1(user.name, ['delete_repo']);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response, {
          data: '',
        });

        await step('Репозиторий не существует', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);

          const isExist = await reposApi.isExist(repoOptions);
          expect(isExist).toBeFalsy();
        });
      },
    );

    [
      {
        title: 'Передан идентификатор несуществующего тенанта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: dg.uuid(),
            projectName: repoOptions.repoName,
            repoName: repoOptions.repoName,
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        title: 'Передано имя несуществующего проекта',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: dg.faker.string.ulid(),
            repoName: repoOptions.repoName,
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Проект с таким именем ${repoOptions.projectName} не найден`,
      },
      {
        title: 'Передано имя несуществующего репозитория',
        generateRepoOptions: (repoOptions: RepoOptions, dg: DataGenerator) => {
          return {
            tenantId: repoOptions.tenantId,
            projectName: repoOptions.projectName,
            repoName: dg.faker.string.ulid(),
          };
        },
        generateDetailMessage: (repoOptions: RepoOptions) =>
          `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
      },
    ].forEach(({ title, generateRepoOptions, generateDetailMessage }) => {
      test(
        `DELETE /api/v3/repos/:tenant/:owner/:repo — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-9725', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);

          const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
          const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

          const realRepoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const repoOptions = generateRepoOptions(realRepoOptions, dataGenerator);
          const path = toPath(repoOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.delete(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(repoOptions),
            instance: path,
          });
        },
      );
    });

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 204 No Content — После удаления можно создать с таким же именем (удаляются файлы на Gitaly)',
      {
        tag: ['@VCS-9970', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response, {
          data: '',
        });

        await step('Репозиторий не существует', async () => {
          const reposApi = apiRegistry.v3.repos.repos.withBasic(user);

          const isExist = await reposApi.isExist(repoOptions);
          expect(isExist).toBeFalsy();
        });

        await entityManager.createRepoV3(projectOptions, repoInfo);
      },
    );

    test(
      'DELETE /api/v3/repos/:tenant/:owner/:repo — 404 Not Found — Нельзя повторно удалить тот же репозиторий',
      {
        tag: ['@VCS-9971', Priority.MINOR],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const repoInfo = await entityManager.createRepoV3(projectOptions);

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        const path = toPath(repoOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.delete(path);

        await HttpResponseAssertions.noContent(response, {
          data: '',
        });

        const repeatResponse = await apiClient.delete(path);
        await HttpResponseAssertions.notFound(repeatResponse, {
          detail: `Репозиторий с таким именем ${repoOptions.repoName} не найден`,
          instance: path,
        });
      },
    );
  },
);
