import { load as loadYaml } from 'js-yaml';

import { VaultService } from '@vcs-pw/services/vault.service';
import { validate } from '@vcs-pw/types';
import { Config, ConfigSchema } from '@vcs-pw/types/config.type';
import { readFile, resolve } from '@vcs-pw/utils/file.util'; // Поскольку здесь используются методы из файла file.util.ts, там нельзя импортировать Config

const ENV_PREFIX = process.env.CONFIG_ENV_PREFIX ?? 'VCS';
const PLACEHOLDER_REGEX = /\{\{\s*([^:\s]+):([^\s\}]+)\s*\}\}/;
const INDEX_REGEX = /^\d+$/;

type RawConfig = Record<string, any>;

type VaultCache = Map<string, Record<string, any>>;

class ConfigLoader {
  private readonly vaultCache: VaultCache = new Map();

  constructor(private readonly vaultService: VaultService) {}

  async load(...configPaths: string[]): Promise<Config> {
    let config: RawConfig = {};

    for (const configPath of configPaths) {
      const fileConfig: RawConfig = await this.loadYamlFile(configPath);
      config = this.mergeDeep(config, fileConfig);
    }

    await this.resolvePlaceholders(config);
    this.applyEnvOverrides(config);
    return validate(ConfigSchema, config).data!;
  }

  private async loadYamlFile(filePath: string): Promise<RawConfig> {
    const content = await readFile(filePath);
    return loadYaml(content) as RawConfig;
  }

  private mergeDeep(target: RawConfig, source: RawConfig): RawConfig {
    for (const key in source) {
      if (
        source[key] !== undefined &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] !== undefined &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        this.mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  private async resolvePlaceholders(config: RawConfig, rootConfig: RawConfig = config): Promise<void> {
    for (const key in config) {
      if (Array.isArray(config[key])) {
        config[key] = await Promise.all(
          config[key].map(async (item: any) => {
            if (typeof item === 'string') {
              return await this.resolveStringAsync(rootConfig, item);
            } else if (typeof item === 'object' && item !== null) {
              await this.resolvePlaceholders(item, rootConfig);
              return item;
            }
            return item;
          }),
        );
      } else if (typeof config[key] === 'object' && config[key] !== null) {
        await this.resolvePlaceholders(config[key], rootConfig);
      } else if (typeof config[key] === 'string') {
        config[key] = await this.resolveStringAsync(rootConfig, config[key]);
      }
    }
  }

  private async resolveStringAsync(config: RawConfig, value: string): Promise<string> {
    let match;
    let result = value;

    while ((match = PLACEHOLDER_REGEX.exec(result)) !== null) {
      const [, protocol, path] = match;
      let replacement = '';

      try {
        switch (protocol) {
          case 'config':
            replacement = this.getNestedValue(config, path);
            break;

          case 'vault':
            const [vaultPath, key] = path.split(':');
            if (!key) {
              throw new Error('Vault заполнитель должен соответствовать формату: vault:path:key');
            }

            let secretData = this.vaultCache.get(vaultPath);
            if (!secretData) {
              secretData = await this.vaultService.read(vaultPath);
              this.vaultCache.set(vaultPath, secretData);
            }

            if (secretData[key] === undefined) {
              throw new Error(`Ключ '${key}' не найден в секрете Vault: ${vaultPath}`);
            }

            replacement = String(secretData[key]);
            break;

          case 'env':
            const envValue = process.env[path];
            if (envValue === undefined) {
              throw new Error(`Не задана переменная окружения: ${path}`);
            }
            replacement = envValue;
            break;

          case 'file':
            replacement = (await readFile(path)).trim();
            break;

          default:
            console.warn(`Неизвестный префикс '${protocol}' в заполнителе`);
            break;
        }
      } catch (error: any) {
        console.error(`Ошибка при разрешении заполнителя {{${protocol}:${path}}}:`, error.message);
      }

      result = result.replace(match[0], replacement);
    }

    return result;
  }

  private getNestedValue(config: RawConfig, path: string): string {
    const keys = path.split('.');
    let current: any = config;

    for (const key of keys) {
      if (Array.isArray(current) && this.isIndex(key)) {
        const index = parseInt(key, 10);
        current = current[index];
      } else {
        current = current?.[key];
      }

      if (current === undefined) {
        throw new Error(`Не найден путь в конфигурации: '${path}'`);
      }
    }

    return String(current);
  }

  private applyEnvOverrides(config: RawConfig, prefix = ENV_PREFIX): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix + '__')) {
        const configPath = key
          .slice(prefix.length + 2)
          .toLowerCase()
          .replace(/__/g, '.');
        this.setNestedValue(config, configPath, value);
      }
    }
  }

  private setNestedValue(config: RawConfig, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current: any = config;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const nextKey = keys[i + 1];
      const isNextKeyNumeric = nextKey ? this.isIndex(nextKey) : false;

      if (isNextKeyNumeric) {
        if (!Array.isArray(current[key])) {
          current[key] = [];
        }
      } else if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
        current[key] = {};
      }

      current = current[key];
    }

    if (this.isIndex(lastKey) && Array.isArray(current)) {
      const index = parseInt(lastKey, 10);
      current[index] = value;
    } else {
      current[lastKey] = value;
    }
  }

  private isIndex(value: string): boolean {
    return INDEX_REGEX.test(value);
  }
}

export const loadConfig = async (vaultService: VaultService, ...files: string[]): Promise<Config> => {
  const loader = new ConfigLoader(vaultService);
  const resolvedPaths = files.map((file) => resolve(file));
  const config = await loader.load(...resolvedPaths);
  console.log('Загружена конфигурация из файлов: ' + files);
  return config;
};
