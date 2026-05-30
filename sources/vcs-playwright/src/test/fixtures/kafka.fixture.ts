import { Fixtures } from '@playwright/test';

import { KafkaService } from '@vcs-pw/services/kafka.service';
import { ConfigWorkerFixture, KafkaWorkerFixture } from '@vcs-pw/test/fixtures/types';

export const workerFixture: Fixtures<object, KafkaWorkerFixture & ConfigWorkerFixture> = {
  kafkaService: [
    async ({ config }, use, workerInfo) => {
      if (!config.kafka) {
        throw new Error('Отсутствует конфигурация для Kafkа (kafka)');
      }

      const kafkaService = new KafkaService(config.kafka, workerInfo.parallelIndex);
      await use(kafkaService);
    },
    { box: true, scope: 'worker' },
  ],
};
