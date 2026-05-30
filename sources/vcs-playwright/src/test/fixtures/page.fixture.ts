import { Fixtures } from '@playwright/test';

import { PageRegistry } from '@vcs-pw/services/page.service';
import { PageWorkerFixture } from '@vcs-pw/test/fixtures/types';

export const workerFixture: Fixtures<object, PageWorkerFixture> = {
  pageRegistry: [
    async ({}, use) => {
      const pageRegistry = new PageRegistry();

      await use(pageRegistry);
    },
    { box: true, scope: 'worker' },
  ],
};
