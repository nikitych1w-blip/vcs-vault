import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const toPath = ({ projectName, repoName }: RepoOptions) => `/api/v1/repos/${projectName}/${repoName}/pulls`;

test.describe(
  'GET /api/v1/repos/:project/:repo/pulls',
  {
    tag: [Layer.API, '@v1', '@pulls', '@get-pulls'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    [
      { tag: '@VCS-4451', state: 'open' },
      { tag: '@VCS-15751', state: 'closed' },
    ].forEach(({ tag, state }) => {
      test(
        `GET /api/v1/repos/:project/:repo/pulls — 200 OK — Получение списка запросов на слияние с фильтром по состоянию (${state})`,
        {
          tag: [tag, Priority.CRITICAL],
        },
        async ({ user, apiRegistry, tenantInfo, entityManager, privilegeService }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

          const [_firstPullInfo, git] = await entityManager.generateAndCreatePullRequest(repoOptions, repoInfo, user);
          const [secondPullInfo, _] = await entityManager.generateAndCreatePullRequest(
            repoOptions,
            repoInfo,
            user,
            git,
          );

          const pullsApi = apiRegistry.v3.repos.pulls.pulls.withBasic(user);
          await pullsApi.declinePull(repoOptions, secondPullInfo.index);

          const path = toPath(repoOptions);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.get(path, { params: { state } });

          await HttpResponseAssertions.ok(response, {
            data: [
              expect.objectContaining({
                state: state,
              }),
            ],
          });
        },
      );
    });

    test(
      `GET /api/v1/repos/:project/:repo/pulls — 200 OK — Получение пустого списка запросов на слияние в инициализированном репозитории`,
      {
        tag: ['@VCS-4450', Priority.NORMAL],
      },
      async ({ tuzToken, apiRegistry, tenantInfo, entityManager }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: true });
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: [],
        });
      },
    );
  },
);
