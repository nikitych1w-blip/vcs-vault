import { expect } from '@playwright/test';

import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import {
  RepositoriesResponseZodType,
  RepoCreateZodType,
  RepositoryV3ZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions, ProjectOptions } from '@vcs-pw/api/v3';
import { config } from '@vcs-pw/config';
import { step } from '@vcs-pw/test';

export class ReposBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  async isExist({ tenantId, projectName, repoName }: RepoOptions): Promise<boolean> {
    const response = await this.get(`${tenantId}/${projectName}/${repoName}`, {
      validateStatus: (number) => isStatus(HttpStatusCode.Ok)(number) || isStatus(HttpStatusCode.NotFound)(number),
    });
    return isStatus(HttpStatusCode.Ok)(response.status);
  }

  async getRepos({ tenantId, projectName }: ProjectOptions): Promise<RepositoriesResponseZodType> {
    return step(`Получение списка репозиториев в проекте ${projectName}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getRepo({ tenantId, projectName, repoName }: RepoOptions): Promise<RepositoryV3ZodType> {
    return step(`Получение информации о репозитории ${repoName}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  deleteRepo({ tenantId, projectName, repoName }: RepoOptions): Promise<void> {
    return step(`Удаление репозитория ${repoName}`, () =>
      this.delete(`${tenantId}/${projectName}/${repoName}`, {
        validateStatus: isStatus(HttpStatusCode.NoContent),
      }),
    );
  }

  createRepo({ tenantId, projectName }: ProjectOptions, options: RepoCreateZodType): Promise<RepositoryV3ZodType> {
    return step(
      `Создание ${this.getVisibilityGenitiveLabel(options.private)} репозитория ${options.name}`,
      async () => {
        const response = await this.post(`${tenantId}/${projectName}`, options, {
          validateStatus: isStatus(HttpStatusCode.Created),
        });
        return response.data;
      },
    );
  }

  async waitForUpdatedGreaterThan(
    options: RepoOptions,
    since: string, // ISO string
  ): Promise<RepositoryV3ZodType> {
    let repo: RepositoryV3ZodType | undefined;
    const target = new Date(since).getTime();
    await expect
      .poll(
        async () => {
          repo = await this.getRepo(options);
          return repo.updated_at ? new Date(repo.updated_at).getTime() : 0;
        },
        {
          message: `Репозиторий был обновлен после ${since}`,
          timeout: config.api.poll.timeout,
          intervals: [config.api.poll.interval],
        },
      )
      .toBeGreaterThan(target);
    return repo!;
  }

  private getVisibilityGenitiveLabel(isPrivate: boolean | null | undefined): string {
    return isPrivate ? 'приватного' : 'публичного';
  }
}
