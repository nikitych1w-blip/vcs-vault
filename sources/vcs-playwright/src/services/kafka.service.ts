import os from 'os';

import { KafkaJS } from '@confluentinc/kafka-javascript';
import { Admin, Consumer, KafkaMessage } from '@confluentinc/kafka-javascript/types/kafkajs';
import _ from 'lodash';
import { expect } from '@playwright/test';

import { log } from '@vcs-pw/logger';
import { step } from '@vcs-pw/test';
import { KafkaConfig } from '@vcs-pw/types/kafka.type';
import { tryJsonParse } from '@vcs-pw/utils/object.util';

const GROUP_ID_PARAM_NAME = 'group.id';
const HOST_NAME = os.hostname();

interface KafkaEvent {
  key: string | undefined;
  value: Record<string, any>;
}

export class KafkaService {
  private readonly config: KafkaConfig;
  private readonly kafka: KafkaJS.Kafka;
  private readonly index: number;

  constructor(config: KafkaConfig, index: number) {
    this.config = config;
    this.kafka = new KafkaJS.Kafka();
    this.index = index;
  }

  private createConsumer(): Consumer {
    const consumer = this.kafka.consumer({
      ...this.config.connection,
      ...this.config.consumer,
      [GROUP_ID_PARAM_NAME]: `${this.config.consumer[GROUP_ID_PARAM_NAME]}-${HOST_NAME}-${this.index}`,
    });
    consumer.logger().setLogLevel(1);
    return consumer;
  }

  private createAdmin(): Admin {
    return this.kafka.admin(this.config.connection);
  }

  async withConsumer<T>(topic: string, action: (consumer: Consumer) => Promise<T>): Promise<T> {
    const consumer = this.createConsumer();
    try {
      await consumer.connect();
      await consumer.subscribe({ topic });
      return await action(consumer);
    } finally {
      await consumer.disconnect().catch(console.error);
    }
  }

  async withAdmin<T>(action: (admin: Admin) => Promise<T>): Promise<T> {
    const admin = this.createAdmin();
    try {
      await admin.connect();
      return await action(admin);
    } finally {
      await admin.disconnect().catch(console.error);
    }
  }

  get topics(): KafkaConfig['topics'] {
    return this.config.topics;
  }

  get issuer(): string {
    return this.config.issuer;
  }

  async expectTopicExists(topic: string): Promise<void> {
    await step('Kafka: Проверка топика на существование', async () => {
      const topics = await this.withAdmin((admin) => admin.listTopics());
      expect(topics, `Топик ${topic} существует`).toContain(topic);
    });
  }

  async fetchEventsByFilter(
    topic: string,
    filter: Partial<KafkaEvent> | Partial<KafkaEvent>[],
    minCount = 1,
  ): Promise<KafkaEvent[]> {
    return await step(`Kafka: Ожидание сообщений в топике ${topic}`, async () => {
      const desiredEvents: KafkaEvent[] = [];
      const filters = Array.isArray(filter) ? filter : [filter];
      log.info('Kafka: Фильтр', { filters });

      await this.withConsumer(topic, async (consumer) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        consumer.run({
          eachMessage: async ({ message }) => {
            const event = this.toKafkaEvent(message);
            log.debug('Kafka: Вычитано событие', { event });

            if (_.some(filters, (f) => _.isMatch(event, f))) {
              desiredEvents.push(event);
            }
          },
        });

        await expect
          .poll(() => desiredEvents.length, {
            message: `Минимум ${minCount} сообщений удовлетворяют фильтру`,
            timeout: this.config.poll.timeout,
            intervals: [this.config.poll.interval],
          })
          .toBeGreaterThanOrEqual(minCount);
      });

      log.info('Kafka: События', { desiredEvents });
      return desiredEvents;
    });
  }

  toKafkaEvent(message: KafkaMessage): KafkaEvent {
    const key = message.key?.toString();
    const value = tryJsonParse(message.value?.toString(), {});
    return { key, value };
  }
}
