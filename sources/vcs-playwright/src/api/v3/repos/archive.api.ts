import { Readable } from 'stream';

import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { V3GetRepositoryArchiveDataZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export const ArchiveFormat = {
  TAR_GZ: 'tar.gz',
  ZIP: 'zip',
} as const;

type ChunkHandler = (chunk: Buffer, totalDownloaded: number) => Promise<void> | void;

export class ReposArchiveBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  getArchive(
    { tenantId, projectName, repoName }: RepoOptions,
    options: V3GetRepositoryArchiveDataZodType['query'],
  ): Promise<ArrayBuffer> {
    return step(`Скачивание архива репозитория ${repoName} для SHA ${options.sha}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/archive`, {
        params: options,
        responseType: 'arraybuffer',
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getArchiveAsStream(
    { tenantId, projectName, repoName }: RepoOptions,
    options: V3GetRepositoryArchiveDataZodType['query'],
    onChunk: ChunkHandler,
  ): Promise<void> {
    return step(`Скачивание архива репозитория ${repoName} для SHA ${options.sha} по чанкам`, async () => {
      const response = await this.get<Readable>(`${tenantId}/${projectName}/${repoName}/archive`, {
        params: options,
        responseType: 'stream',
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      const stream = response.data;
      let totalDownloaded = 0;

      return new Promise<void>((resolve, reject) => {
        stream.on('data', async (chunk: Buffer) => {
          totalDownloaded += chunk.length;
          try {
            await onChunk(chunk, totalDownloaded);
          } catch (error) {
            reject(error);
          }
        });

        stream.on('end', () => resolve());
        stream.on('error', (err) => reject(err));
      });
    });
  }
}
