import { Fixtures } from '@playwright/test';

import { S3Service } from '@vcs-pw/services/s3.service';
import { ConfigWorkerFixture, S3WorkerFixture } from '@vcs-pw/test/fixtures/types';

export const workerFixture: Fixtures<object, S3WorkerFixture & ConfigWorkerFixture> = {
  s3Service: [
    async ({ config }, use) => {
      if (!config.s3) {
        throw new Error('Отсутствует конфигурация для S3 (s3)');
      }

      const s3Service = new S3Service(config.s3);
      await use(s3Service);
    },
    { box: true, scope: 'worker' },
  ],
};
