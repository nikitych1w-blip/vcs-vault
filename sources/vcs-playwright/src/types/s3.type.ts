import { z } from 'zod';

import { PollSchema } from '@vcs-pw/types';

const DEFAULT_STORAGES = {
  attachments: 'attachments',
  repoArchives: 'repo-archive',
  avatars: 'avatars',
  tempUploads: 'temp-uploads',
  lfs: 'lfs',
} as const;

export const S3Schema = z.object({
  region: z.string(),
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  endpoint: z.string(),
  bucket: z.string(),
  poll: PollSchema,
  storages: z
    .object({
      attachments: z.string().default(DEFAULT_STORAGES.attachments),
      repoArchives: z.string().default(DEFAULT_STORAGES.repoArchives),
      avatars: z.string().default(DEFAULT_STORAGES.avatars),
      tempUploads: z.string().default(DEFAULT_STORAGES.tempUploads),
      lfs: z.string().default(DEFAULT_STORAGES.lfs),
    })
    .default(DEFAULT_STORAGES),
});

export type S3Config = z.infer<typeof S3Schema>;
