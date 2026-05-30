import { zRepositoryV3 } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { DataGenerator } from '@vcs-pw/services/data.service';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { removeUndefined } from '@vcs-pw/utils/object.util';

const FIRST_PULL_INDEX = 1;

const toPath = ({ tenantId, projectName, repoName }: RepoOptions) =>
  `/api/v3/repos/${tenantId}/${projectName}/${repoName}`;

test.describe(
  'GET /api/v3/repos/:tenant/:owner/:repo',
  {
    tag: [Layer.API, '@v3', '@repos', '@get-repo'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v3/repos/:tenant/:owner/:repo — 200 OK — Получение репозитория с привилегией read на проект`,
      {
        tag: ['@VCS-10745', Priority.CRITICAL],
        annotation: [
          Annotation.DESCRIPTION(`
            1. На проект выдана привилегия read.
            2. На репозиторий привилегии не выдаются.`),
        ],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(
          response,
          removeUndefined({
            zodSchema: zRepositoryV3,
            data: {
              ...repoInfo,
              updated_at: expect.stringIso(),
              system_labels: {
                tier0: false,
              },
              licenses: expect.arrayEqualsInAnyOrder(repoInfo.licenses),
            },
          }),
        );
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:owner/:repo — 200 OK — Получение репозитория с привилегией read на репозиторий`,
      {
        tag: ['@VCS-12872', Priority.CRITICAL],
        annotation: [
          Annotation.DESCRIPTION(`
            1. На проект не выдана привилегия.
            2. На репозиторий выдана привилегия read.
            3. Дополнительно проверяются параметры stats: слежение, избранное, запросы на слияние. Форки на данный момент не работают.`),
        ],
      },
      async ({ userPool, tenantInfo, apiRegistry, entityManager, privilegeService, authService, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const firstUser = userPool.get();
        const secondUser = userPool.get();
        const thirdUser = userPool.get();

        await privilegeService.grantToRepo(repoOptions, firstUser.name, PrivilegeGroup.WRITER);
        await privilegeService.grantToRepo(repoOptions, secondUser.name, PrivilegeGroup.READER);
        await privilegeService.grantToRepo(repoOptions, thirdUser.name, PrivilegeGroup.READER);

        const [_, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, firstUser);
        await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, firstUser, git);

        const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(firstUser);
        await pullsApi.declinePull(repoOptions, FIRST_PULL_INDEX);

        const firstUserAuthSession = await authService.createAuthenticatedSession(firstUser);
        const secondUserAuthSession = await authService.createAuthenticatedSession(secondUser);
        const thirdUserAuthSession = await authService.createAuthenticatedSession(thirdUser);

        const firstUserReactWebApi = apiRegistry.web.v2.projects.repos.repos.withRequest(firstUserAuthSession.request);
        const secondUserReactWebApi = apiRegistry.web.v2.projects.repos.repos.withRequest(
          secondUserAuthSession.request,
        );
        const thirdUserReactWebApi = apiRegistry.web.v2.projects.repos.repos.withRequest(thirdUserAuthSession.request);

        await firstUserReactWebApi.favorite(repoOptions);
        await secondUserReactWebApi.favorite(repoOptions);
        await thirdUserReactWebApi.favorite(repoOptions);

        const subscribeOptions = dataGenerator.subscribeRepoRequest();
        await firstUserReactWebApi.subscribe(repoOptions, subscribeOptions);
        await secondUserReactWebApi.subscribe(repoOptions, subscribeOptions);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(thirdUser);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(
          response,
          removeUndefined({
            zodSchema: zRepositoryV3,
            data: {
              ...repoInfo,
              updated_at: expect.stringIso(),
              stats: {
                watchers: 2,
                stars: 3,
                forks: 0,
                open_pull_requests: 1, // Всего 2 PR, но один закрыт
              },
              system_labels: {
                tier0: false,
              },
              licenses: expect.arrayEqualsInAnyOrder(repoInfo.licenses),
            },
          }),
        );
      },
    );

    test(
      `GET /api/v3/repos/:tenant/:owner/:repo — 200 OK — Получение публичного репозитория`,
      {
        tag: ['@VCS-12873', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: false });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
      },
    );

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
        `GET /api/v3/repos/:tenant/:owner/:repo — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12866', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.get(path, {
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
        `GET /api/v3/repos/:tenant/:owner/:repo — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-12866', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeRepoOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
            repoName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeRepoOptions);
          const apiClient = apiRegistry.client.anonymous();

          const response = await apiClient.get(path, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии read',
      {
        tag: ['@VCS-12867', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии read с токеном со скоупом repo',
      {
        tag: ['@VCS-12868', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_REPO_MSG,
          instance: path,
        });
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo',
      {
        tag: ['@VCS-12869', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const token = await entityManager.createAccessTokenV1(user.name, []);
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      'GET /api/v3/repos/:tenant/:owner/:repo — 200 OK — Выполнение запроса с токеном со скоупом repo',
      {
        tag: ['@VCS-12870', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService }) => {
        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response);
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
        `GET /api/v3/repos/:tenant/:owner/:repo — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-12871', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

          const projectOptions = { tenant_key: tenantInfo.tenant_key, project_key: projectInfo.project_key };
          const repoInfo = await entityManager.createRepoV2(tenantInfo.id, projectOptions);

          const realRepoOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name, repoName: repoInfo.name };

          const repoOptions = generateRepoOptions(realRepoOptions, dataGenerator);
          const path = toPath(repoOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.get(path);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(repoOptions),
            instance: path,
          });
        },
      );
    });
  },
);
