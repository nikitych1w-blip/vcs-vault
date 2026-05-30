import { faker } from '@faker-js/faker';
import { Fixtures } from '@playwright/test';

import { UsersBackApi } from '@vcs-pw/api/v1/users/users.api';

import {
  OneWorkTaskTrackerIntegrationService,
  StandaloneTrackerIntegrationService,
  UnitTaskTrackerService,
} from '@vcs-pw/services/task-tracker.service';

import {
  ApiWorkerFixture,
  AuthTestFixture,
  CleanupTestFixture,
  ConfigWorkerFixture,
  DataTestFixture,
  DataWorkerFixture,
  TestContext,
  UserWorkerFixture,
} from '@vcs-pw/test/fixtures/types';

import { DataGenerator, EntityManager } from '@vcs-pw/services/data.service';
import { DatabasePool, DatabaseService } from '@vcs-pw/services/database.service';
import ExecRunner from '@vcs-pw/services/exec.service';
import FileSystemService from '@vcs-pw/services/file.service';
import GitService from '@vcs-pw/services/git.service';
import ImageService from '@vcs-pw/services/image.service';
import { SshKeyPairService, SshKeygen, SshService } from '@vcs-pw/services/ssh.service';

export const testFixture: Fixtures<
  DataTestFixture & ApiWorkerFixture & AuthTestFixture & DataWorkerFixture & CleanupTestFixture & ConfigWorkerFixture
> = {
  testContext: [
    async ({}, use) => {
      const context: TestContext = {
        put(this, params: Record<string, unknown>) {
          Object.assign(this, params);
        },
      };
      await use(context);
    },
    { box: true },
  ],

  entityManager: [
    async (
      {
        config,
        cleanup,
        dataGenerator,
        databaseService,
        fileSystemService,
        sshKeyPairService,
        gitService,
        apiRegistry,
        projectsInternalApi,
        usersTokensV1Api,
        tenantsV2Api,
        projectsV2Api,
        projectsReposV2Api,
        adminUsersKeysV2Api,
        adminUsersV2Api,
        reposV3Api,
      },
      use,
    ) => {
      const entityManager = new EntityManager(
        config,
        cleanup,
        dataGenerator,
        databaseService,
        fileSystemService,
        sshKeyPairService,
        gitService,
        apiRegistry,
        projectsInternalApi,
        usersTokensV1Api,
        tenantsV2Api,
        projectsV2Api,
        projectsReposV2Api,
        adminUsersKeysV2Api,
        adminUsersV2Api,
        reposV3Api,
      );
      await use(entityManager);
    },
    { box: true },
  ],

  taskTrackerIntegrationService: [
    async ({ entityManager, config, owCoordinatorRequest }, use) => {
      let service;
      if (config.ow) {
        service = new OneWorkTaskTrackerIntegrationService(entityManager, owCoordinatorRequest, config.ow);
      } else {
        if (!config.tt) {
          throw new Error('Отсутствует конфигурация для TaskTracker (tt)');
        }
        service = new StandaloneTrackerIntegrationService(entityManager, config.tt);
      }
      await use(service);
    },
    { box: true },
  ],

  unitTaskTrackerService: [
    async ({ dataGenerator, config }, use) => {
      if (!config.tt) {
        throw new Error('Отсутствует конфигурация для TaskTracker (tt)');
      }
      const service = new UnitTaskTrackerService(config.tt, dataGenerator);
      await use(service);
    },
    { box: true },
  ],

  gitService: [
    async ({ fileSystemService, dataGenerator }, use) => {
      const gitService = new GitService(fileSystemService, dataGenerator);
      await use(gitService);
    },
    { box: true },
  ],

  fileSystemService: [
    async ({ cleanup, dataGenerator }, use) => {
      const fileSystemService = new FileSystemService(cleanup, dataGenerator);
      await use(fileSystemService);
    },
    { box: true },
  ],

  sshKeyPairService: [
    async ({ fileSystemService }, use) => {
      const execRunner = new ExecRunner();
      const sshKeygen = new SshKeygen(execRunner);
      const sshService = new SshService(execRunner);
      const sshKeyPairService = new SshKeyPairService(fileSystemService, sshKeygen, sshService);
      await use(sshKeyPairService);
    },
    { box: true },
  ],
};

export const workerFixture: Fixtures<
  object,
  DataWorkerFixture & ApiWorkerFixture & ConfigWorkerFixture & UserWorkerFixture
> = {
  dataGenerator: [
    async ({}, use) => {
      const dataGenerator = new DataGenerator(faker);
      await use(dataGenerator);
    },
    { box: true, scope: 'worker' },
  ],

  tuzToken: [
    async ({ usersTokensV1Api, dataGenerator, tuz }, use) => {
      const username = tuz.name;
      const tokenName = `${username}-${dataGenerator.uuid()}`;
      const token = await usersTokensV1Api.createToken(username, { name: tokenName, scopes: ['all'] });

      await use(token.sha1);

      await usersTokensV1Api.deleteTokenByName(username, tokenName);
    },
    { title: 'Генерация для ТУЗ токена со скоупом all', scope: 'worker' },
  ],

  adminToken: [
    async ({ usersTokensV1Api, dataGenerator, localAdmin }, use) => {
      const username = localAdmin.name;
      const tokenName = `${username}-${dataGenerator.uuid()}`;
      const token = await usersTokensV1Api.createToken(username, { name: tokenName, scopes: ['sudo', 'all'] });

      await use(token.sha1);

      await usersTokensV1Api.deleteTokenByName(username, tokenName);
    },
    { title: 'Генерация для админа токена со скоупом sudo, all', scope: 'worker' },
  ],

  tenantInfo: [
    async ({ config, tenantsV2Api }, use) => {
      const tenantInfo = await tenantsV2Api.getTenant({ tenant_key: config.sc.tenant });

      await use(tenantInfo);
    },
    { title: 'Получение информации о текущем тенанте', scope: 'worker' },
  ],

  // Обновляем объекты пользователей, в других фикстурах используются ссылки на них => изменения подтянутся
  getUserInfo: [
    async ({ config }, use) => {
      const api = new UsersBackApi({
        baseUrl: config.api.baseUrl,
        auth: {
          user: config.sc.localAdmin,
        },
      });

      const users = [...config.sc.users, config.sc.admin, config.sc.tuz];

      for (const user of users) {
        // Считаем флагом определяющим, была ранее запрошена информация или нет
        if (!user.id) {
          const userInfo = await api.getUser(user.name);
          user.id = userInfo.id;
          user.loginName = userInfo.login_name;
          user.lowerName = userInfo.username.toLowerCase();
          user.fullName = userInfo.full_name;
          user.email = userInfo.email;
        }
      }

      await use(() => {
        /* empty */
      });
    },
    { title: 'Получение информации о пользователях', scope: 'worker' },
  ],

  imageService: [
    async ({}, use) => {
      const imageService = new ImageService();
      await use(imageService);
    },
    { box: true, scope: 'worker' },
  ],

  databaseService: [
    async ({ config }, use) => {
      if (!config.db) {
        throw new Error('Отсутствует конфигурация для подключения к БД (db)');
      }
      const dbPool = new DatabasePool(config.db);
      const dbService = new DatabaseService(dbPool, config.db.poll);
      await use(dbService);
      await dbPool.close();
    },
    { box: true, scope: 'worker' },
  ],
};
