import { z } from 'zod';

import { PollSchema } from '@vcs-pw/types';
import { KafkaConfigSchema } from '@vcs-pw/types/kafka.type';
import { S3Schema } from '@vcs-pw/types/s3.type';
import { SourceControlUserSchema, UserSchema } from '@vcs-pw/types/user.type';

const DEFAULT_LOGGING = { level: 'info', type: 'pino' } as const;

const DEFAULT_TT_SUITS = { task: 'task', prUpstream: 'prupstream' } as const;

export const ACCESS_MANAGEMENT_TYPE = {
  KEYCLOAK: 'keycloak',
  NGAM: 'ngam',
  SC: 'sc',
} as const;

const LoggingSchema = z
  .object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default(DEFAULT_LOGGING.level),
    type: z.enum(['pino', 'console']).default(DEFAULT_LOGGING.type),
  })
  .default(DEFAULT_LOGGING);

const UiSchema = z.object({
  baseUrl: z.url(),
  proxiedBaseUrl: z.url(), // Хост-приложение проксирует запросы на SC BE
  reactApiBaseUrl: z.url(), // Новые ручки для Front 2.0
  auth: z.enum(Object.values(ACCESS_MANAGEMENT_TYPE)).default(ACCESS_MANAGEMENT_TYPE.SC),
  responseTimeout: z.number().default(10_000),
});

const ApiSchema = z.object({
  baseUrl: z.url(),
  basicAuthBaseUrl: z.url(), // Вынесено отдельно, так как в ПАО и СБТ разные точки доступа для BasicAuth. В ПАО напрямую в SC, в СБТ через OW (IAM Proxy)
  timeout: z.number().default(60_000),
  poll: PollSchema,
});

const DbSchema = z.object({
  url: z.url(),
  schema: z.string().default('public'),
  user: UserSchema,
  poll: PollSchema,
});

const OwSchema = z.object({
  baseUrl: z.url(),
  coordinator: UserSchema,
  tools: z.object({
    sc: z.string(),
    tt: z.string().optional(),
  }),
  poll: PollSchema,
});

const TtSchema = z.object({
  baseUrl: z.url(),
  admin: UserSchema,
  suits: z
    .object({
      task: z.string().default(DEFAULT_TT_SUITS.task),
      prUpstream: z.string().default(DEFAULT_TT_SUITS.prUpstream),
    })
    .default(DEFAULT_TT_SUITS),
  poll: PollSchema,
});

const ScSchema = z.object({
  name: z.string(),
  tenant: z.string(),
  tuz: SourceControlUserSchema,
  localAdmin: UserSchema,
  admin: SourceControlUserSchema,
  users: z.array(SourceControlUserSchema).min(1),
  privilegesPoll: PollSchema,
  ssh: z.object({
    host: z.string(),
    user: z.string(),
    port: z.number(),
  }),
});

export const ConfigSchema = z.object({
  ui: UiSchema,
  api: ApiSchema,
  ow: OwSchema.optional(),
  tt: TtSchema.optional(),
  db: DbSchema.optional(),
  sc: ScSchema,
  logging: LoggingSchema,
  kafka: KafkaConfigSchema.optional(),
  s3: S3Schema.optional(),
});

export type DatabaseConfig = z.infer<typeof DbSchema>;
export type Config = z.infer<typeof ConfigSchema>;
