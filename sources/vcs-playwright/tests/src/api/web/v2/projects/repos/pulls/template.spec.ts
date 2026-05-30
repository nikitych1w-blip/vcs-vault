import { RepositoryV3ZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions as RepoOptionsV3 } from '@vcs-pw/api/v3';
import { RepoOptions } from '@vcs-pw/api/web';
import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { getRandomElement } from '@vcs-pw/utils/object.util';

const TEMPLATE_PATHS = [
  `PULL_REQUEST_TEMPLATE.md`,
  `pull_request_template.md`,
  `.gitea/PULL_REQUEST_TEMPLATE.md`,
  `.gitea/pull_request_template.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`,
  `.github/pull_request_template.md`,
];

const toPath = ({ projectName, repoName }: RepoOptions) => `/web/v2/repos/${projectName}/${repoName}/pulls/template`;

interface ThisTestContext {
  repoOptions: RepoOptionsV3;
  repoInfo: RepositoryV3ZodType;
}

test.describe(
  'GET /web/v2/repos/:owner/:repo/pulls/template',
  {
    tag: [Layer.API, '@web', '@v2', '@get-pull-template'],
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
        repoInfo,
      });
    });

    test(
      `GET /web/v2/repos/:owner/:repo/pulls/template — 200 OK — Получение шаблона запроса на слияние`,
      {
        tag: ['@VCS-13630', Priority.CRITICAL],
      },
      async ({ user, testContext, apiRegistry, authService, privilegeService, dataGenerator }) => {
        const { repoOptions, repoInfo } = testContext as unknown as ThisTestContext;
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const templateContent = dataGenerator.faker.lorem.paragraphs();

        const fileApi = apiRegistry.v3.repos.contents.file.withBasic(user);
        await fileApi.createFile(repoOptions, {
          filepath: getRandomElement(TEMPLATE_PATHS),
          content: templateContent,
          branch: repoInfo.default_branch,
          message: dataGenerator.faker.git.commitMessage(),
        });

        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.READER);

        const context = await authService.createAuthenticatedSession(user);

        const path = toPath(repoOptions);
        const apiClient = apiRegistry.web.client.withRequest(context.request);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: templateContent,
          xRequestIdHeader: false,
        });
      },
    );

    test(
      `GET /web/v2/repos/:owner/:repo/pulls/template — 401 Unauthorized — Заголовок Authorization содержит пустой Bearer`,
      {
        tag: ['@VCS-13634', Priority.CRITICAL],
      },
      async ({ apiRegistry, dataGenerator }) => {
        const fakeRepoOptions = {
          projectName: dataGenerator.faker.string.ulid(),
          repoName: dataGenerator.faker.string.ulid(),
        };

        const path = toPath(fakeRepoOptions);
        const apiClient = apiRegistry.client.anonymous();

        const response = await apiClient.get(path, {
          headers: { Authorization: 'Bearer ' },
        });

        await HttpResponseAssertions.unauthorizedWeb(response);
      },
    );

    test(
      `GET /web/v2/repos/:owner/:repo/pulls/template — 403 Forbidden — Заголовок Authorization содержит невалидный Bearer`,
      {
        tag: ['@VCS-13633', Priority.CRITICAL],
      },
      async ({ apiRegistry, dataGenerator }) => {
        const fakeRepoOptions = {
          projectName: dataGenerator.faker.string.ulid(),
          repoName: dataGenerator.faker.string.ulid(),
        };

        const path = toPath(fakeRepoOptions);
        const apiClient = apiRegistry.client.anonymous();

        const response = await apiClient.get(path, {
          headers: { Authorization: `Bearer ${dataGenerator.faker.internet.jwt()}` },
        });

        await HttpResponseAssertions.forbiddenWeb(response);
      },
    );
  },
);
