import dotenv from 'dotenv';
import vault, { client } from 'node-vault';

import { VaultConfig, loadVaultConfig } from '@vcs-pw/types/vault.type';

dotenv.config({ quiet: true });

export interface VaultService {
  read(path: string): Promise<Record<string, any>>;
}

class MockVaultService implements VaultService {
  async read(_: string): Promise<Record<string, any>> {
    throw new Error('Vault не подключен');
  }
}

class SecmanVaultService implements VaultService {
  private readonly client: client;
  private readonly config: VaultConfig;
  private readonly secretBasePath: string;

  private constructor(config: VaultConfig) {
    this.config = config;
    this.client = vault({
      endpoint: this.config.host,
    });
    this.secretBasePath =
      this.config.kvVersion === 1 ? `${this.config.mountPoint}/` : `${this.config.mountPoint}/data/`;
  }

  static async create(config: VaultConfig): Promise<SecmanVaultService> {
    const instance = new SecmanVaultService(config);
    instance.client.token = await instance.connect(config.user.name, config.user.password);
    return instance;
  }

  async read(path: string): Promise<Record<string, any>> {
    const requestPath = this.secretBasePath + path;
    const result = await this.client.read(requestPath);

    if (!result?.data) {
      throw new Error(`Секрет не найден: ${path}`);
    }
    return this.config.kvVersion === 1 ? result.data : result.data.data;
  }

  private async connect(roleId: string, secretId: string): Promise<string> {
    const result = await this.client.approleLogin({
      role_id: roleId,
      secret_id: secretId,
    });
    return result.auth.client_token;
  }
}

export const vaultService: VaultService =
  process.env.VAULT_ENABLED === 'true' ? await SecmanVaultService.create(loadVaultConfig()) : new MockVaultService();
