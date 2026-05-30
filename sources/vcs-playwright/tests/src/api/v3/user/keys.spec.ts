import _ from 'lodash';

import { zUserKey, UserKeyCreateZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { DataGenerator, ALL_CHARS, CYRILLIC_CHARS, ALPHANUMERIC_CHARS } from '@vcs-pw/services/data.service';
import FileSystemService from '@vcs-pw/services/file.service';
import { SshKeyPairService, KeyType, SshKeyPair } from '@vcs-pw/services/ssh.service';
import { step } from '@vcs-pw/test';
import { expect, test } from '@vcs-pw/test/ext';
import { Layer } from '@vcs-pw/test/tags';
import { Annotation, Priority } from '@vcs-pw/types/annotation.type';
import { HttpResponseAssertions } from '@vcs-pw/types/api/assert.type';
import { PrivilegeGroup } from '@vcs-pw/types/privilege-group.type';

const PATH = '/api/v3/user/keys';

const toValidTitle = (dg: DataGenerator) => {
  return dg.faker.string.fromCharacters(ALL_CHARS, { min: 1, max: 50 });
};

const toValidBody = async (
  dg: DataGenerator,
  sshService: SshKeyPairService,
  fileSystemService: FileSystemService,
): Promise<[UserKeyCreateZodType, SshKeyPair]> => {
  const sshPair = await sshService.generateSshKeyPair();
  const publicKeyValue = await fileSystemService.readFile(sshPair.publicKeyPath);
  return [
    {
      title: toValidTitle(dg),
      key: publicKeyValue,
      read_only: dg.randomBoolean(),
    },
    sshPair,
  ];
};

test.describe(
  'POST /api/v3/user/keys',
  {
    tag: [Layer.API, '@v3', '@add-user-key'],
    annotation: [Annotation.OWNER('Lokkina.O.S')],
  },
  () => {
    Object.values(KeyType)
      .map((keyType) => ({
        title: `Тип ключа ${keyType}`,
        keyType,
      }))
      .forEach(({ title, keyType }) => {
        test(
          `POST /api/v3/user/keys — 201 Created — Добавление SSH-ключа пользователя. ${title}`,
          {
            tag: ['@VCS-9977', Priority.CRITICAL],
            annotation: Annotation.DESCRIPTION(`
            1. Передаются только обязательные параметры.
            2. Осуществляется проверка, что добавленным ключом можно пройти аутентификацию.
            3. Формат ключа: <тип_ключа> <base64_строка> [комментарий]. Комментарий опционален.`),
          },
          async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, config, entityManager }) => {
            const sshPair = await sshKeyPairService.generateSshKeyPair(keyType);
            const publicKeyValue = await fileSystemService.readFile(sshPair.publicKeyPath);
            const fingerprint = await sshKeyPairService.getFingerprint(sshPair.publicKeyPath);

            const body = {
              title: toValidTitle(dataGenerator),
              key: publicKeyValue,
            };

            const apiClient = apiRegistry.client.withBasic(user);
            const response = await apiClient.post(PATH, body);

            entityManager.addDeleteKeyHook(user.loginName!, body.title);

            await HttpResponseAssertions.created(response, {
              zodSchema: zUserKey,
              data: {
                id: expect.any(Number),
                title: body.title.trim(),
                key: body.key.trim(),
                read_only: false,
                user_login: user.name,
                created_at: expect.stringIso(),
                fingerprint: fingerprint,
              },
            });

            await step('Успешная аутентификация по SSH', async () => {
              const output = await sshKeyPairService.tryAuthenticate(sshPair.privateKeyPath, config.sc.ssh);
              const escapedTitle = _.escapeRegExp(body.title);
              const regExp = new RegExp(
                `${user.name}.*successfully authenticated with the key named ${escapedTitle}`,
                'i',
              );
              expect(output, 'Аутентификация успешна').toMatch(regExp);
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
      {
        title: 'Заголовок Authorization имеет пустой token',
        generateAuthHeader: (_: DataGenerator) => {
          return { Authorization: 'token ' };
        },
      },
    ].forEach(({ title, generateAuthHeader }) => {
      test(
        `POST /api/v3/user/keys — 401 Unauthorized — ${title}`,
        {
          tag: ['@VCS-9978', Priority.CRITICAL],
        },
        async ({ apiRegistry, dataGenerator }) => {
          const apiClient = apiRegistry.client.anonymous();
          const response = await apiClient.post(PATH, {
            headers: { ...generateAuthHeader(dataGenerator) },
          });

          await HttpResponseAssertions.unauthorizedV2(response);
        },
      );
    });

    test(
      `POST /api/v3/user/keys — 201 Created — Запрещена отправка изменений при read_only = true`,
      {
        tag: ['@VCS-12625', Priority.NORMAL],
      },
      async ({
        user,
        apiRegistry,
        dataGenerator,
        sshKeyPairService,
        fileSystemService,
        entityManager,
        tenantInfo,
        privilegeService,
        gitService,
      }) => {
        const [body, sshPair] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        body.read_only = true;

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(user.loginName!, body.title);

        await HttpResponseAssertions.created(response, {
          zodSchema: zUserKey,
        });

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user, sshPair.privateKeyPath);

        const cloneResult = await git.clone(repoInfo.links.ssh);
        expect(cloneResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).not.toBeOk();
        expect(generateCommitsResult.error?.message).toMatch(/Key.* is read-only and cannot write to/i);
      },
    );

    test(
      `POST /api/v3/user/keys — 201 Created — Разрешена отправка изменений при read_only = false`,
      {
        tag: ['@VCS-12626', Priority.NORMAL],
      },
      async ({
        user,
        apiRegistry,
        dataGenerator,
        sshKeyPairService,
        fileSystemService,
        entityManager,
        tenantInfo,
        privilegeService,
        gitService,
      }) => {
        const [body, sshPair] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        body.read_only = false;

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(user.loginName!, body.title);

        await HttpResponseAssertions.created(response, {
          zodSchema: zUserKey,
        });

        const projectInfo = await entityManager.createProjectV2(tenantInfo.tenant_key);

        const projectOptions = { tenantId: tenantInfo.id, projectName: projectInfo.name };
        const repoInfo = await entityManager.createRepoV3(projectOptions, { private: true, auto_init: true });

        const repoOptions = { ...projectOptions, repoName: repoInfo.name };
        await privilegeService.grantToRepo(repoOptions, user.name, PrivilegeGroup.WRITER);

        const git = await gitService.getConfiguredGit(user, sshPair.privateKeyPath);

        const cloneResult = await git.clone(repoInfo.links.ssh);
        expect(cloneResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(1);
        expect(generateCommitsResult).toBeOk();
      },
    );

    test(
      `POST /api/v3/user/keys — 201 Created — Добавление ключа с помощью токена со скоупом write:public_key`,
      {
        tag: ['@VCS-12627', Priority.NORMAL],
      },
      async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(user.name, ['write:public_key']);

        const [body, _] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(user.loginName!, body.title);

        await HttpResponseAssertions.created(response, {
          zodSchema: zUserKey,
        });
      },
    );

    test(
      `POST /api/v3/user/keys — 403 Forbidden — Нет прав на выполнение запроса для токена без скоупа write:public_key`,
      {
        tag: ['@VCS-12628', Priority.NORMAL],
      },
      async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, entityManager }) => {
        const token = await entityManager.createAccessTokenV1(user.name, []);

        const [body, _] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        const apiClient = apiRegistry.client.withToken(token);
        const response = await apiClient.post(PATH, body);

        await HttpResponseAssertions.forbiddenV2(response, 'token does not have required scope: write:public_key');
      },
    );

    test(
      `POST /api/v3/user/keys — 400 Bad Request — Передан приватный ключ вместо публичного`,
      {
        tag: ['@VCS-12629', Priority.NORMAL],
      },
      async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService }) => {
        const sshPair = await sshKeyPairService.generateSshKeyPair();
        const privateKeyValue = await fileSystemService.readFile(sshPair.privateKeyPath);
        const body = {
          title: toValidTitle(dataGenerator),
          key: privateKeyValue,
        };
        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(PATH, body);

        await HttpResponseAssertions.badRequest(response, {
          validation: [
            {
              location: 'field',
              name: 'key',
              error: 'Значение поля key не является публичным ключом',
              code: 'invalid_key_value',
            },
          ],
          instance: PATH,
        });
      },
    );

    test(
      `POST /api/v3/user/keys — 409 Conflict — Публичный ключ уникален в рамках инсталляции`,
      {
        tag: ['@VCS-12630', Priority.NORMAL],
      },
      async ({ userPool, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, entityManager }) => {
        const firstUser = userPool.get();
        const secondUser = userPool.get();

        const [body, _] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);

        const firstApiClient = apiRegistry.client.withBasic(firstUser);
        const firstResponse = await firstApiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(firstUser.loginName!, body.title);

        await HttpResponseAssertions.created(firstResponse);

        body.title = toValidTitle(dataGenerator);
        const secondApiClient = apiRegistry.client.withBasic(secondUser);
        const secondResponse = await secondApiClient.post(PATH, body);

        await HttpResponseAssertions.conflict(secondResponse, {
          detail: expect.stringContaining('Конфликт при создании ресурса'),
          instance: PATH,
        });
      },
    );

    test(
      `POST /api/v3/user/keys — 409 Conflict — Имя ключа должно быть уникально в разрезе пользователя`,
      {
        tag: ['@VCS-12631', Priority.NORMAL],
      },
      async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, entityManager }) => {
        const apiClient = apiRegistry.client.withBasic(user);

        const [body, _] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        const firstResponse = await apiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(user.loginName!, body.title);

        await HttpResponseAssertions.created(firstResponse);

        const [secondBody, _sshPair] = await toValidBody(dataGenerator, sshKeyPairService, fileSystemService);
        secondBody.title = body.title;
        const secondResponse = await apiClient.post(PATH, body);

        await HttpResponseAssertions.conflict(secondResponse, {
          detail: expect.stringContaining('Конфликт при создании ресурса'),
          instance: PATH,
        });
      },
    );

    test(
      `POST /api/v3/user/keys — 201 Created — Добавление ключа в формате PEM`,
      {
        tag: ['@VCS-12696', Priority.NORMAL],
        annotation: Annotation.DESCRIPTION(`
            1. Конвертацию в PEM поддерживают RSA ключи.
            2. В ответе возвращается RSA ключ без комментария.
            3. Формат ключа: <тип_ключа> <base64_строка> [комментарий].`),
      },
      async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, config, entityManager }) => {
        const sshPair = await sshKeyPairService.generateSshKeyPair(KeyType.RSA);
        const fingerprint = await sshKeyPairService.getFingerprint(sshPair.publicKeyPath);
        const pemFormat = await sshKeyPairService.convertToPem(sshPair.publicKeyPath);
        const publicKeyValue = await fileSystemService.readFile(sshPair.publicKeyPath);

        const body = {
          title: toValidTitle(dataGenerator),
          key: pemFormat,
        };

        const apiClient = apiRegistry.client.withBasic(user);
        const response = await apiClient.post(PATH, body);

        entityManager.addDeleteKeyHook(user.loginName!, body.title);

        await HttpResponseAssertions.created(response, {
          zodSchema: zUserKey,
          data: {
            id: expect.any(Number),
            title: body.title,
            key: sshKeyPairService.removeComment(publicKeyValue),
            read_only: false,
            user_login: user.name,
            created_at: expect.stringIso(),
            fingerprint: fingerprint,
          },
        });

        await step('Успешная аутентификация по SSH', async () => {
          const output = await sshKeyPairService.tryAuthenticate(sshPair.privateKeyPath, config.sc.ssh);
          const regExp = new RegExp(`${user.name}.*successfully authenticated`, 'i');
          expect(output, 'Аутентификация успешна').toMatch(regExp);
        });
      },
    );

    [
      {
        title: 'Заголовок содержит 1 символ',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.title = dg.faker.string.fromCharacters(ALL_CHARS, 1);
          return body;
        },
      },
      {
        title: 'Заголовок содержит 50 символов',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.title = dg.faker.string.fromCharacters(ALL_CHARS, 50);
          return body;
        },
      },
      {
        title: 'Ключ не содержит комментарий',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.key = sshService.removeComment(body.key);
          return body;
        },
      },
      {
        title: 'Ключ содержит комментарий на кириллице',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.key = sshService.removeComment(body.key) + ' ' + dg.faker.string.fromCharacters(CYRILLIC_CHARS, 10);
          return body;
        },
      },
      {
        title: 'Указано содержимое ключа без типа',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.key = sshService.retrieveKey(body.key);
          return body;
        },
      },
    ].forEach(({ title, generateBody }) => {
      test(
        `POST /api/v3/user/keys — 201 Created — Допустимые значения обязательных полей. ${title}`,
        {
          tag: ['@VCS-12697', Priority.NORMAL],
        },
        async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService, entityManager }) => {
          const body = await generateBody(dataGenerator, sshKeyPairService, fileSystemService);

          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(PATH, body);

          entityManager.addDeleteKeyHook(user.loginName!, body.title);

          await HttpResponseAssertions.created(response);
        },
      );
    });

    [
      {
        title: 'Имя ключа равно пустой строке',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.title = '';
          return body;
        },
        validationErrors: [
          {
            location: 'field',
            name: 'title',
            error: 'title должен быть не пустой и не более 50 символов',
            code: 'invalid_title_length',
          },
        ],
      },
      {
        title: 'Имя ключа не передано',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          const { title, ...other } = body;
          return other;
        },
        validationErrors: [
          {
            location: 'field',
            name: 'title',
            error: 'title должен быть не пустой и не более 50 символов',
            code: 'invalid_title_length',
          },
        ],
      },
      {
        title: 'Имя ключа содержит 51 символ',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.title = dg.faker.string.fromCharacters(ALPHANUMERIC_CHARS, 51);
          return body;
        },
        validationErrors: [
          {
            location: 'field',
            name: 'title',
            error: 'title должен быть не пустой и не более 50 символов',
            code: 'invalid_title_length',
          },
        ],
      },
      {
        title: 'Указан невалидный PEM ключ',
        generateBody: async (
          dg: DataGenerator,
          _sshService: SshKeyPairService,
          _fileSystemService: FileSystemService,
        ) => {
          return {
            title: toValidTitle(dg),
            key: `-----BEGIN PUBLIC KEY-----\n${btoa(dg.faker.string.alphanumeric(8))}\n-----END PUBLIC KEY-----`,
          };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
      {
        title: 'Указан поврежденный ключ',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.key = sshService.removeComment(body.key).slice(0, -1);
          return body;
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
      {
        title: 'Значение ключа не передано',
        generateBody: async (
          dg: DataGenerator,
          _sshService: SshKeyPairService,
          _fileSystemService: FileSystemService,
        ) => {
          return {
            title: toValidTitle(dg),
          };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
      {
        title: 'Значение ключа равно пустой строке',
        generateBody: async (
          dg: DataGenerator,
          _sshService: SshKeyPairService,
          _fileSystemService: FileSystemService,
        ) => {
          return {
            title: toValidTitle(dg),
            key: '',
          };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
      {
        title: 'Указан невалидный формат ключа',
        generateBody: async (
          dg: DataGenerator,
          sshService: SshKeyPairService,
          fileSystemService: FileSystemService,
        ) => {
          const [body, _] = await toValidBody(dg, sshService, fileSystemService);
          body.key = sshService.removeComment(body.key).slice(1);
          return body;
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
      {
        title: 'Указан тип ключа без содержимого',
        generateBody: async (
          dg: DataGenerator,
          _sshService: SshKeyPairService,
          _fileSystemService: FileSystemService,
        ) => {
          return {
            title: toValidTitle(dg),
            key: 'ssh-rsa',
          };
        },
        validationErrors: [
          {
            location: 'field',
            name: 'key',
            error: 'Значение поля key не является публичным ключом',
            code: 'invalid_key_value',
          },
        ],
      },
    ].forEach(({ title, generateBody, validationErrors }) => {
      test(
        `POST /api/v3/user/keys — 400 Bad Request — ${title}`,
        {
          tag: ['@VCS-12701', Priority.NORMAL],
        },
        async ({ user, apiRegistry, dataGenerator, sshKeyPairService, fileSystemService }) => {
          const body = await generateBody(dataGenerator, sshKeyPairService, fileSystemService);
          const apiClient = apiRegistry.client.withBasic(user);
          const response = await apiClient.post(PATH, body);

          await HttpResponseAssertions.badRequest(response, { validation: validationErrors, instance: PATH });
        },
      );
    });
  },
);
