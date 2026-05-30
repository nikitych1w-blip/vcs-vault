import { z } from 'zod';

import { validate } from '@vcs-pw/types';
import { UserSchema } from '@vcs-pw/types/user.type';

const VaultConfigSchema = z.object({
  host: z.url(),
  namespace: z.string().min(1),
  mountPoint: z.string().min(1),
  kvVersion: z
    .union([z.literal(1), z.literal(2), z.literal('1').transform(() => 1), z.literal('2').transform(() => 2)])
    .pipe(z.union([z.literal(1), z.literal(2)])),
  user: UserSchema,
});

export type VaultConfig = z.infer<typeof VaultConfigSchema>;

export const loadVaultConfig = (): VaultConfig => {
  let raw = {
    host: process.env.VAULT_HOST,
    namespace: process.env.VAULT_NAMESPACE ?? 'root',
    mountPoint: process.env.VAULT_MOUNT_POINT,
    kvVersion: process.env.VAULT_KV_VERSION,
    user: {
      name: process.env.VAULT_ROLE_ID,
      password: process.env.VAULT_SECRET_ID,
    },
  };
  return validate(VaultConfigSchema, raw).data!;
};
