import { test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';

const toPath = ({ projectName, repoName }: RepoOptions, ref: string, path: string) =>
  `/api/v1/repos/${projectName}/${repoName}/raw/${ref}/${path}`;

test.describe(
  'GET /api/v1/repos/:project/:repo/raw/:ref/:path',
  {
    tag: [Layer.API, '@v1', '@get-file-raw'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    test(
      `GET /api/v1/repos/:owner/:repo/raw/:ref/:path — 200 OK — Получение содержимого файла по ссылке (ref) и пути`,
      {
        tag: ['@VCS-4485', Priority.CRITICAL],
      },
      async ({ tuzToken, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        const repoInfo = await entityManager.createRepoV3(projectOptions);
        const repoOptions = { ...projectOptions, repoName: repoInfo.name };

        const fileContent = dataGenerator.faker.lorem.paragraphs();

        const fileApi = apiRegistry.v3.repos.contents.file.withToken(tuzToken);
        const fileInfo = await fileApi.createFile(repoOptions, {
          filepath: dataGenerator.filePath(),
          content: fileContent,
          branch: repoInfo.default_branch,
          message: dataGenerator.faker.git.commitMessage(),
        });

        const path = toPath(repoOptions, repoInfo.default_branch, fileInfo.content!.path!);
        const apiClient = apiRegistry.client.withToken(tuzToken);
        const response = await apiClient.get(path);

        await HttpResponseAssertions.ok(response, {
          data: fileContent,
        });
      },
    );

    [
      { tag: '@VCS-15749', title: 'инициализирован', autoInit: true },
      { tag: '@VCS-15750', title: 'неинициализирован', autoInit: false },
    ].forEach(({ tag, title, autoInit }) => {
      test(
        `GET /api/v1/repos/:owner/:repo/raw/:ref/:path — 404 Not Found — Файл не существует (репозиторий ${title})`,
        {
          tag: [tag, Priority.NORMAL],
        },
        async ({ tuzToken, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

          const repoInfo = await entityManager.createRepoV3(projectOptions, { auto_init: autoInit });
          const repoOptions = { ...projectOptions, repoName: repoInfo.name };

          const path = toPath(repoOptions, repoInfo.default_branch, dataGenerator.filePath());
          const apiClient = apiRegistry.client.withToken(tuzToken);
          const response = await apiClient.get(path);

          await HttpResponseAssertions.notFoundV2(response, 'Цель не найдена.');
        },
      );
    });
  },
);
