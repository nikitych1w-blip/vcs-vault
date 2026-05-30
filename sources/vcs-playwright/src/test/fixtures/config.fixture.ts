import { Fixtures } from '@playwright/test';

import { config as loadedConfig } from '@vcs-pw/config';
import { ConfigWorkerFixture } from '@vcs-pw/test/fixtures/types';

export const workerFixture: Fixtures<object, ConfigWorkerFixture> = {
  config: [
    async ({}, use) => {
      await use(loadedConfig);
    },
    { box: true, scope: 'worker' },
  ],
};
