import { Fixtures } from '@playwright/test';

import { log } from '@vcs-pw/logger';
import CleanupStack from '@vcs-pw/types/cleanup.type';

import { CleanupTestFixture } from '@vcs-pw/test/fixtures/types';

export const testFixture: Fixtures<CleanupTestFixture> = {
  cleanup: async ({}, use) => {
    const cleanup = new CleanupStack();

    await use(cleanup);

    while (cleanup.length() > 0) {
      const func = cleanup.pop();
      if (!func) continue;
      try {
        await Promise.resolve(func());
      } catch (error) {
        let errorObj;
        if (error instanceof Error) {
          errorObj = {
            name: error.name,
            message: error.message,
          };
        } else {
          errorObj = {
            error: { name: 'UnknownError', message: 'Неизвестная ошибка' },
          };
        }
        log.error('Ошибка в cleanup-функции', errorObj);
      }
    }
  },
};
