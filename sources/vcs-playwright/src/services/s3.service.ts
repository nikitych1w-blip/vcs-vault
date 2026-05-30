import { expect } from '@playwright/test';

import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  _Object,
} from '@aws-sdk/client-s3';
import { step } from '@vcs-pw/test';
import { S3Config } from '@vcs-pw/types/s3.type';

import { HttpStatusCode } from '@vcs-pw/api/client';

class S3OperationError extends Error {
  constructor(
    message: string,
    public originalError?: any,
  ) {
    super(message);
    this.name = 'S3Error';
  }
}

async function handleS3Error<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    throw new S3OperationError('S3: Ошибка при выполнении операции', error);
  }
}

async function handleS3Predicate(fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error: any) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === HttpStatusCode.NotFound) {
      return false;
    }
    throw new S3OperationError('S3: Ошибка при проверке существования', error);
  }
}

class S3PrefixService {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly prefix: string,
    private readonly pollConfig: S3Config['poll'],
  ) {}

  private absolutePath(key: string) {
    return `${this.prefix}/${key}`;
  }

  async isExists(key: string) {
    return handleS3Predicate(async () => {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
    });
  }

  async get(key: string) {
    const fullPath = this.absolutePath(key);
    return await step(`S3: Получение файла '${fullPath}'`, async () =>
      handleS3Error(async () => {
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: fullPath,
        });
        return await this.client.send(command);
      }),
    );
  }

  async list(since?: number) {
    return handleS3Error(async () => {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.prefix,
      });

      const result = await this.client.send(command);
      const contents = result.Contents || [];

      if (since !== undefined) {
        const sinceDate = new Date(since);
        return contents.filter((obj) => obj.LastModified && obj.LastModified >= sinceDate);
      }

      return contents;
    });
  }

  async waitForSince(since: number): Promise<string[]> {
    return await step(`S3: Ожидание появления новых файлов`, async () => {
      let files: _Object[] = [];
      await expect
        .poll(
          async () => {
            files = await this.list(since);
            return files;
          },
          {
            message: `S3: В бакете ${this.bucket}:${this.prefix} отсутствуют файлы с LastModified >= ${since}`,
            timeout: this.pollConfig.timeout,
            intervals: [this.pollConfig.interval],
          },
        )
        .not.toHaveLength(0);
      return files.map((file) => file.Key).filter((key): key is string => !!key);
    });
  }

  async waitForExistence(key: string): Promise<void> {
    const fullPath = this.absolutePath(key);
    await step(`S3: Ожидание появления файла '${fullPath}'`, () =>
      expect
        .poll(async () => this.isExists(fullPath), {
          message: `S3: Файл ${this.bucket}:${fullPath} не найден`,
          timeout: this.pollConfig.timeout,
          intervals: [this.pollConfig.interval],
        })
        .toBe(true),
    );
  }

  async waitForAbsence(key: string): Promise<void> {
    const fullPath = this.absolutePath(key);
    await step(`S3: Ожидание изчезновения файла '${fullPath}'`, () =>
      expect
        .poll(async () => this.isExists(fullPath), {
          message: `S3: Файл ${this.bucket}:${fullPath} существует`,
          timeout: this.pollConfig.timeout,
          intervals: [this.pollConfig.interval],
        })
        .toBe(false),
    );
  }
}

export class S3Service {
  readonly attachments: S3PrefixService;
  readonly avatars: S3PrefixService;
  readonly repoArchives: S3PrefixService;
  readonly tempUploads: S3PrefixService;

  private client: S3Client;
  private bucket: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucket = config.bucket;

    this.attachments = new S3PrefixService(this.client, this.bucket, config.storages.attachments, config.poll);
    this.avatars = new S3PrefixService(this.client, this.bucket, config.storages.avatars, config.poll);
    this.repoArchives = new S3PrefixService(this.client, this.bucket, config.storages.repoArchives, config.poll);
    this.tempUploads = new S3PrefixService(this.client, this.bucket, config.storages.tempUploads, config.poll);
  }

  async isBucketExists() {
    return handleS3Predicate(async () => {
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.client.send(command);
    });
  }
}
