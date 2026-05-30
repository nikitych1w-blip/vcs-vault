import { zRepositoryV3 } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { ProjectOptions } from '@vcs-pw/api/v3';
import {
  ALPHANUMERIC_CHARS,
  CYRILLIC_CHARS,
  DataGenerator,
  DIGIT_CHARS,
  LATIN_CHARS,
  README_DEFAULT,
  SPECIAL_REPO_NAME_CHARACTERS,
  VALID_REPO_NAME_CHARACTERS,
} from '@vcs-pw/services/data.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions, NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';
import { removeUndefined } from '@vcs-pw/utils/object.util';
import { getPath } from '@vcs-pw/utils/url.util';

const toPath = ({ tenantId, projectName }: ProjectOptions) => `/api/v3/repos/${tenantId}/${projectName}`;

test.describe(
  'POST /api/v3/repos/:tenant/:owner',
  {
    tag: [Layer.API, '@v3', '@repos', '@create-repo'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    [
      {
        title: 'Только обязательные поля. Название репозитория в 1 символ (числа)',
        generateBody: (dg: DataGenerator): Record<string, any> => {
          return { name: dg.faker.string.fromCharacters(DIGIT_CHARS, 1) };
        },
      },
      {
        title: 'Только обязательные поля. Название репозитория в 1 символ (латиница)',
        generateBody: (dg: DataGenerator): Record<string, any> => {
          return { name: dg.faker.string.fromCharacters(LATIN_CHARS, 1) };
        },
      },
      {
        title: 'Только обязательные поля. Название репозитория в 1 символ (дефис)',
        generateBody: (_: DataGenerator): Record<string, any> => {
          return { name: '-' };
        },
      },
      {
        title: 'Только обязательные поля. Название репозитория в 1 символ (нижнее подчеркивание)',
        generateBody: (_: DataGenerator): Record<string, any> => {
          return { name: '_' };
        },
      },
      {
        title: 'Только обязательные поля. Название репозитория в 1 символ (точка)',
        generateBody: (_: DataGenerator): Record<string, any> => {
          return { name: '.' };
        },
      },
      {
        title: 'Только обязательные поля. Название репозитория в 100 символов',
        generateBody: (dg: DataGenerator): Record<string, any> => {
          return { name: dg.faker.string.fromCharacters(VALID_REPO_NAME_CHARACTERS, 100) };
        },
      },
      {
        title: 'Часть полей. Имя ветки в 100 символов кириллицы, описание в 0 символов, auto_init=true, readme=Default',
        generateBody: (dg: DataGenerator): Record<string, any> => {
          return {
            name: dg.faker.string.fromCharacters(VALID_REPO_NAME_CHARACTERS, { min: 1, max: 100 }),
            default_branch: dg.faker.string.fromCharacters(CYRILLIC_CHARS, 100),
            description: '',
            auto_init: true,
            readme: README_DEFAULT,
          };
        },
      },
      {
        title: 'Все поля. Имя ветки в 1 символ, описание в 2048 символов',
        generateBody: (dg: DataGenerator): Record<string, any> => {
          return dg.createRepoV3Request(
            {
              default_branch: dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 1),
              description: dg.faker.string.fromCharacters(CYRILLIC_CHARS, 2048),
            },
            false,
          );
        },
      },
    ].forEach(({ title, generateBody }) => {
      test(
        `POST /api/v3/repos/:tenant/:owner — 201 Created — ${title}`,
        {
          tag: ['@VCS-9709', Priority.CRITICAL],
        },
        async ({ user, config, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

          const request = generateBody(dataGenerator);
          const repoOptions = { ...projectOptions, repoName: request.name };
          const path = toPath(projectOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.post(path, request);
          entityManager.addDeleteRepoHook(repoOptions);

          await HttpResponseAssertions.created(
            response,
            removeUndefined({
              zodSchema: zRepositoryV3,
              data: {
                name: request.name,
                full_name: `/${projectInfo.name}/${request.name}`,
                visibility: !!request.private ? 'private' : 'limited',
                default_branch: request.default_branch ?? 'main',
                fork: false,
                template: request.template ?? false,
                description: request.description || undefined,
                archived: false,
                empty: !request.auto_init,
                language: request.language,
                created_at: expect.stringIso(),
                updated_at: expect.stringIso(),
                stats: {
                  stars: 0,
                  forks: 0,
                  watchers: 0,
                  open_pull_requests: 0,
                },
                owner: {
                  name: projectInfo.name,
                  url: `${config.ui.baseUrl}${projectInfo.name}`,
                },
                links: {
                  html: `${config.ui.baseUrl}${projectInfo.name}/${request.name}`,
                  clone: `${config.ui.baseUrl}${projectInfo.name}/${request.name}.git`,
                  ssh: expect.stringMatching(
                    new RegExp(`ssh://git@[\\d\\w.]+:\\d{4}/${projectInfo.name}/${request.name}\.git`),
                  ),
                },
                licenses: !!request.license && !!request.auto_init ? expect.arrayContaining([expect.any(String)]) : [],
              },
            }),
          );
          expect
            .soft(response)
            .toHaveLocationHeader(getPath(config.ui.baseUrl, `/${projectOptions.projectName}/${request.name}`));

          await step('Успешно возвращаются данные по созданному репозиторию', async () => {
            const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
            const repoInfo = await reposApi.getRepo(repoOptions);

            expect(repoInfo).toEqual({
              ...response.data,
              updated_at: expect.stringIso(),
              licenses: expect.arrayEqualsInAnyOrder(repoInfo.licenses),
            });
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
        `POST /api/v3/repos/:tenant/:owner — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9710', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions);
          const apiClient = apiRegistry.client.anonymous();

          const request = dataGenerator.createRepoV3Request();
          const response = await apiClient.post(path, request, {
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
        `POST /api/v3/repos/:tenant/:owner — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9710', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const fakeProjectOptions = {
            tenantId: dataGenerator.uuid(),
            projectName: dataGenerator.faker.string.ulid(),
          };

          const path = toPath(fakeProjectOptions);
          const apiClient = apiRegistry.client.anonymous();

          const request = dataGenerator.createRepoV3Request();
          const response = await apiClient.post(path, request, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      'POST /api/v3/repos/:tenant/:owner — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии create',
      {
        tag: ['@VCS-9711', Priority.CRITICAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };

        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const request = dataGenerator.createRepoV3Request();
        const path = toPath(projectOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG,
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:owner — 403 Forbidden — Нет прав на выполнение запроса при отсутствии привилегии create с токеном со скоупом repo',
      {
        tag: ['@VCS-9712', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.WRITER);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);
        const request = dataGenerator.createRepoV3Request();
        const path = toPath(projectOptions);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.forbidden(response, {
          detail: NOT_ENOUGH_PRIVILEGES_TO_ACCESS_THE_PROJECT_MSG,
          instance: path,
        });
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:owner — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа repo',
      {
        tag: ['@VCS-9713', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const token = await entityManager.createAccessTokenV1(user.name, []);
        const request = dataGenerator.createRepoV3Request();
        const path = toPath(projectOptions);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: repo');
      },
    );

    test(
      'POST /api/v3/repos/:tenant/:owner — 201 Created — Выполнение запроса с токеном со скоупом repo',
      {
        tag: ['@VCS-9714', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const token = await entityManager.createAccessTokenV1(user.name, ['repo']);
        const request = dataGenerator.createRepoV3Request();
        const repoOptions = { ...projectOptions, repoName: request.name };
        const path = toPath(projectOptions);

        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(path, request);
        entityManager.addDeleteRepoHook(repoOptions);

        await HttpResponseAssertions.created(response, {
          zodSchema: zRepositoryV3,
        });
      },
    );

    [
      {
        title: 'Передан идентификатор несуществующего тенанта',
        generateProjectOptions: (_: { id: string }, projectInfo: { name: string }, dg: DataGenerator) => {
          return { tenantId: dg.uuid(), projectName: projectInfo.name };
        },
        generateDetailMessage: (_: ProjectOptions) => 'Тенант с таким UUID не найден',
      },
      {
        title: 'Передано имя несуществующего проекта',
        generateProjectOptions: (tenantInfo: { id: string }, _: { name: string }, dg: DataGenerator) => {
          return { tenantId: tenantInfo.id, projectName: dg.faker.string.ulid() };
        },
        generateDetailMessage: (projectOptions: ProjectOptions) =>
          `Проект с таким именем ${projectOptions.projectName} не найден`,
      },
    ].forEach(({ title, generateProjectOptions, generateDetailMessage }) => {
      test(
        `POST /api/v3/repos/:tenant/:owner — 404 Not Found — ${title}`,
        {
          tag: ['@VCS-9715', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
          const projectOptions = generateProjectOptions(tenantInfo, projectInfo, dataGenerator);

          const request = dataGenerator.createRepoV3Request();
          const path = toPath(projectOptions);

          const apiClient = apiRegistry.client.withBasic(user);

          const response = await apiClient.post(path, request);

          await HttpResponseAssertions.notFound(response, {
            detail: generateDetailMessage(projectOptions),
            instance: path,
          });
        },
      );
    });

    test(
      `POST /api/v3/repos/:tenant/:owner — 409 Conflict — Имя репозитория должно быть уникальным в рамках проекта`,
      {
        tag: ['@VCS-9716', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator, privilegeService }) => {
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const name = dataGenerator.faker.string.alpha({ length: 15, casing: 'lower' });
        await entityManager.createRepoV3(projectOptions, { name: name });

        const request = dataGenerator.createRepoV3Request();
        request.name = name.toUpperCase();
        const path = toPath(projectOptions);

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(path, request);

        await HttpResponseAssertions.conflict(response, {
          detail: expect.stringContaining('Репозиторий с таким именем (без учёта регистра) уже существует в проекте'),
          instance: path,
        });
      },
    );

    test(
      `POST /api/v3/repos/:tenant/:owner — 201 Created — Разрешено создание репозиториев с одинаковым именем в разных проектах`,
      {
        tag: ['@VCS-9717', Priority.NORMAL],
      },
      async ({ user, tenantInfo, apiRegistry, entityManager, dataGenerator, privilegeService }) => {
        // Первый проект
        const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

        const request = dataGenerator.createRepoV3Request();

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(toPath(projectOptions), request);
        await HttpResponseAssertions.created(response);

        // Второй проект
        const secordPprojectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
        const secordProjectOptions = { tenantId: tenantInfo.id, projectName: secordPprojectInfo.name };
        await privilegeService.grantToProject(secordProjectOptions, user.name, PrivilegeGroup.MANAGER);

        const secondResponse = await apiClient.post(toPath(secordProjectOptions), request);
        await HttpResponseAssertions.created(secondResponse);
      },
    );

    [
      {
        title: 'Отсутствует название репозитория',
        generateBody: (_: DataGenerator) => {
          return { name: '' };
        },
        validationError: {
          location: 'field',
          name: 'name',
          error: 'Отсутствует обязательное поле name',
          code: 'missing_field_repo_name_format',
        },
      },
      {
        title: 'Название репозитория >100 символов',
        generateBody: (dg: DataGenerator) => {
          return { name: dg.faker.string.fromCharacters(SPECIAL_REPO_NAME_CHARACTERS, 101) };
        },
        validationError: {
          location: 'field',
          name: 'name',
          error: expect.stringContaining(
            'Имя репозитория должно содержать от 1 до 100 символов и включать только латинские буквы, цифры, тире, точки и подчёркивания',
          ),
          code: 'invalid_repo_name_format',
        },
      },
      {
        title: 'Название репозитория на кириллице',
        generateBody: (dg: DataGenerator) => {
          return { name: dg.faker.string.fromCharacters(CYRILLIC_CHARS, { min: 1, max: 100 }) };
        },
        validationError: {
          location: 'field',
          name: 'name',
          error: expect.stringContaining(
            'Имя репозитория должно содержать от 1 до 100 символов и включать только латинские буквы, цифры, тире, точки и подчёркивания',
          ),
          code: 'invalid_repo_name_format',
        },
      },
      {
        title: 'README не задан при включенной инициализации',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.auto_init = true;
          data.readme = undefined;
          return data;
        },
        validationError: {
          location: 'field',
          name: 'readme',
          error: 'При включённой автоматической инициализации необходимо указать шаблон README',
          code: 'readme_required_with_auto_init',
        },
      },
      {
        title: 'В описании >2048 символов',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.description = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 2049);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'description',
          error: expect.stringContaining('Описание репозитория не должно превышать 2048 символов'),
          code: 'description_too_long',
        },
      },
      {
        title: 'Имя ветки в 0 символов',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.default_branch = '';
          return data;
        },
        validationError: {
          location: 'field',
          name: 'name',
          error: 'Некорректная длинна имени ветки. Минимальная длинна 1 символ',
          code: 'invalid_repo_name_format',
        },
      },
      {
        title: 'Имя ветки > 100 символов',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.default_branch = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 101);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'default_branch',
          error: 'Некорректная длинна имени ветки. Максимальная длинна 100 символов',
          code: 'invalid_new_branch_name_length',
        },
      },
      {
        title: 'Не существущее имя gitignores',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.gitignores = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 15);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'gitignores',
          error: expect.stringContaining('Шаблон .gitignore с таким именем не существует'),
          code: 'gitignore_not_supported',
        },
      },
      {
        title: 'Не существущее имя readme',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.readme = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 15);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'readme',
          error: expect.stringContaining('Шаблон readme с таким именем не существует'),
          code: 'invalid_template_type',
        },
      },
      {
        title: 'Не существущее имя license',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.license = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 15);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'license',
          error: expect.stringContaining('Лицензия с таким идентификатором не поддерживается'),
          code: 'license_not_supported',
        },
      },
      {
        title: 'Не существущее имя issue_labels',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.issue_labels = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 15);
          return data;
        },
        validationError: {
          location: 'field',
          name: 'issue_labels',
          error: expect.stringContaining('Набор меток с таким именем не существует'),
          code: 'issue_labels_not_supported',
        },
      },
      {
        title: 'Имя ветки равно символу собаки',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.default_branch = '@';
          return data;
        },
        validationError: {
          location: 'field',
          name: 'default_branch',
          error: expect.stringContaining("Имя не может являться символом собаки ('@')"),
          code: 'invalid_new_branch_name',
        },
      },
      {
        title: 'Имя ветки содержит .lock',
        generateBody: (dg: DataGenerator) => {
          const data = dg.createRepoV3Request();
          data.default_branch = data.default_branch + '.lock';
          return data;
        },
        validationError: {
          location: 'field',
          name: 'default_branch',
          error: expect.stringContaining("Имя не может содержать подстрок вида '.lock/', '.lock' в конце наименования"),
          code: 'invalid_new_branch_name',
        },
      },
      ...[...'/.'].map((char) => {
        return {
          title: `Имя ветки начинается на '${char}'`,
          generateBody: (dg: DataGenerator) => {
            const data = dg.createRepoV3Request();
            data.default_branch = char + data.default_branch;
            return data;
          },
          validationError: {
            location: 'field',
            name: 'default_branch',
            error: expect.stringContaining('Название не может начинаться с точки или с символа косой черты'),
            code: 'invalid_new_branch_name',
          },
        };
      }),
      ...[...'/.'].map((char) => {
        return {
          title: `Имя ветки оканчивается на '${char}'`,
          generateBody: (dg: DataGenerator) => {
            const data = dg.createRepoV3Request();
            data.default_branch = data.default_branch + char;
            return data;
          },
          validationError: {
            location: 'field',
            name: 'default_branch',
            error: expect.stringContaining(
              "Название ветки не должно оканчиваться на точку ('.') или символ косой черты ('/')",
            ),
            code: 'invalid_new_branch_name',
          },
        };
      }),
      ...[...' ~^:?*['].map((char) => {
        return {
          title: `Имя ветки содержит '${char}'`,
          generateBody: (dg: DataGenerator) => {
            const data = dg.createRepoV3Request();
            data.default_branch = data.default_branch + char;
            return data;
          },
          validationError: {
            location: 'field',
            name: 'default_branch',
            error: expect.stringContaining(
              "Имя не может содержать символов пробелов (''), тильд ('~'), домика ('^'), двоеточия (':'),знаков вопроса ('?'), звездочек ('*'), открывающихся квадратных скобочек ('[')",
            ),
            code: 'invalid_new_branch_name',
          },
        };
      }),
      ...['/.', '..', '//', '@{'].map((chars) => {
        return {
          title: `Имя ветки содержит '${chars}'`,
          generateBody: (dg: DataGenerator) => {
            const data = dg.createRepoV3Request();
            data.default_branch = data.default_branch + chars + data.default_branch;
            return data;
          },
          validationError: {
            location: 'field',
            name: 'default_branch',
            error: expect.stringContaining("Имя не может содержать подстрок вида: '/.', '..', '//', '@{'"),
            code: 'invalid_new_branch_name',
          },
        };
      }),
      ...[...'"!%$±'].map((char) => {
        return {
          title: `Имя ветки содержит '${char}'`,
          generateBody: (dg: DataGenerator) => {
            const data = dg.createRepoV3Request();
            data.default_branch = data.default_branch + char + data.default_branch;
            return data;
          },
          validationError: {
            location: 'field',
            name: 'default_branch',
            error: expect.stringContaining('Имя не может содержать символов с ASCII-кодом от 0 до 37, а так же 177'),
            code: 'invalid_new_branch_name',
          },
        };
      }),
    ].forEach(({ title, generateBody, validationError }) => {
      test(
        `POST /api/v3/repos/:tenant/:owner — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-9718', Priority.NORMAL],
        },
        async ({ user, tenantInfo, apiRegistry, entityManager, privilegeService, dataGenerator }) => {
          const projectInfo = await entityManager.createLimitedProjectV2(tenantInfo.tenant_key);
          const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
          await privilegeService.grantToProject(projectOptions, user.name, PrivilegeGroup.MANAGER);

          const request = generateBody(dataGenerator);
          const path = toPath(projectOptions);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(path, request);

          await HttpResponseAssertions.badRequest(response, { validation: [validationError], instance: path });

          await step('Репозиторий не существует', async () => {
            const reposApi = apiRegistry.v3.repos.repos.withBasic(user);
            const repos = await reposApi.getRepos(projectOptions);
            expect(repos.repositories).toHaveLength(0);
          });
        },
      );
    });
  },
);
