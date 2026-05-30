import { loadConfig } from '@vcs-pw/config/loader';
import { vaultService } from '@vcs-pw/services/vault.service';
import { Config } from '@vcs-pw/types/config.type';

export const config: Config = await loadConfig(
  vaultService,
  ...(process.env.VCS_CONFIG?.split(',') ?? ['config/config.yaml']),
);

export type { Config };
