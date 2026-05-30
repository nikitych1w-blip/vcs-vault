import { Fixtures } from '@playwright/test';

import {
  ApiWorkerFixture,
  ConfigWorkerFixture,
  DataWorkerFixture,
  UserWorkerFixture,
} from '@vcs-pw/test/fixtures/types';

import { ApiRegistry } from '@vcs-pw/services/api.service';
import { PrivilegeService } from '@vcs-pw/services/privilege.service';

/**
 * Фикстуры API с уже предустановленными параметрами auth. Например, где-то это локальный админ, где-то ТУЗ и его токен
 */
export const workerFixture: Fixtures<
  object,
  ApiWorkerFixture & ConfigWorkerFixture & UserWorkerFixture & DataWorkerFixture
> = {
  apiRegistry: [
    async ({}, use) => {
      const apiRegistry = new ApiRegistry();

      await use(apiRegistry);
    },
    { box: true, scope: 'worker' },
  ],

  privilegeService: [
    async ({ config, apiRegistry, projectsPrivilegesV3Api, reposPrivilegesV3Api, cacheApi }, use) => {
      const privilegeService = new PrivilegeService(
        config,
        apiRegistry,
        projectsPrivilegesV3Api,
        reposPrivilegesV3Api,
        cacheApi,
      );

      await use(privilegeService);
    },
    { box: true, scope: 'worker' },
  ],

  projectsInternalApi: [
    async ({ config, apiRegistry }, use) => {
      const api = new apiRegistry.internal.projects({
        baseUrl: config.api.baseUrl,
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  usersTokensV1Api: [
    async ({ config, localAdmin, apiRegistry }, use) => {
      const api = new apiRegistry.v1.users.tokens({
        baseUrl: config.api.baseUrl,
        auth: {
          user: localAdmin,
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  tenantsV2Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v2.tenants({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  projectsV2Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v2.projects.projects({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  projectsReposV2Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v2.projects.repos({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  adminUsersKeysV2Api: [
    async ({ config, localAdmin, apiRegistry }, use) => {
      const api = new apiRegistry.v2.admin.users.keys({
        baseUrl: config.api.baseUrl,
        auth: {
          user: localAdmin,
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  adminUsersV2Api: [
    async ({ config, localAdmin, apiRegistry }, use) => {
      const api = new apiRegistry.v2.admin.users.users({
        baseUrl: config.api.baseUrl,
        auth: {
          user: localAdmin,
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  projectsPrivilegesV3Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v3.projects.privileges({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  reposPrivilegesV3Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v3.repos.privileges({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  reposV3Api: [
    async ({ config, tuzToken, apiRegistry }, use) => {
      const api = new apiRegistry.v3.repos.repos({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: tuzToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],

  cacheApi: [
    async ({ config, adminToken, apiRegistry }, use) => {
      const api = new apiRegistry.v3.cache({
        baseUrl: config.api.baseUrl,
        auth: {
          token: {
            type: 'token',
            value: adminToken,
          },
        },
      });

      await use(api);
    },
    { box: true, scope: 'worker' },
  ],
};
