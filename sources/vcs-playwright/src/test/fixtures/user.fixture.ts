import { Fixtures } from '@playwright/test';

import {
  ConfigWorkerFixture,
  DataWorkerFixture,
  UserTestFixture,
  UserWorkerFixture,
} from '@vcs-pw/test/fixtures/types';
import ItemPool from '@vcs-pw/types/pool.type';
import { SourceControlUser } from '@vcs-pw/types/user.type';

export const testFixture: Fixtures<UserTestFixture & DataWorkerFixture & ConfigWorkerFixture> = {
  userPool: [
    async ({ config, getUserInfo }, use) => {
      getUserInfo();
      const pool = new ItemPool<SourceControlUser>(config.sc.users);
      await use(pool);
    },
    { box: true },
  ],

  user: [
    async ({ userPool }, use) => {
      await use(userPool.get());
    },
    { box: true },
  ],
};

export const workerFixture: Fixtures<object, UserWorkerFixture & DataWorkerFixture & ConfigWorkerFixture> = {
  tuz: [
    async ({ config, getUserInfo }, use) => {
      getUserInfo();
      await use(config.sc.tuz);
    },
    { box: true, scope: 'worker' },
  ],

  localAdmin: [
    async ({ config }, use) => {
      await use(config.sc.localAdmin);
    },
    { box: true, scope: 'worker' },
  ],

  admin: [
    async ({ config, getUserInfo }, use) => {
      getUserInfo();
      await use(config.sc.admin);
    },
    { box: true, scope: 'worker' },
  ],
};
