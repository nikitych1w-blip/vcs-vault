import { z } from 'zod';

import { PollSchema } from '@vcs-pw/types';

const KAFKA_CONFIG_MAP = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]));

/**
 * В connection/consumer указываются параметры конфигурации: https://github.com/confluentinc/librdkafka/blob/v2.3.0/CONFIGURATION.md
 */
export const KafkaConfigSchema = z.object({
  issuer: z.string(),
  connection: KAFKA_CONFIG_MAP,
  consumer: KAFKA_CONFIG_MAP,
  topics: z.object({
    repos: z.string(),
    pulls: z.string(),
    commits: z.string(),
  }),
  poll: PollSchema,
});

export type KafkaConfig = z.infer<typeof KafkaConfigSchema>;
