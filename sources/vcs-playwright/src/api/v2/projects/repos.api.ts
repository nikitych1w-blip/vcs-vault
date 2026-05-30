import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import {
  CreateRepoOptionsZodType,
  RepoZodType,
  V2GetRepoDataZodType,
} from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { step } from '@vcs-pw/test';

export type RepoInfo = RepoZodType;
type RepoOptions = V2GetRepoDataZodType['query'];

export type CreateRepoOptions = CreateRepoOptionsZodType;

export class ProjectsReposBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v2/projects/repos',
    });
  }

  getRepo(options: RepoOptions): Promise<RepoInfo> {
    return step(`Получение репозитория по ключу ${options.repo_key}`, async () => {
      const response = await this.get('', {
        params: options,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  createRepo(options: CreateRepoOptions): Promise<RepoInfo> {
    return step(
      `Создание ${this.getVisibilityGenitiveLabel(options.private)} репозитория ${options.name}`,
      async () => {
        const response = await this.post('', options, {
          validateStatus: isStatus(HttpStatusCode.Created),
        });
        return response.data;
      },
    );
  }

  private getVisibilityGenitiveLabel(isPrivate: boolean | undefined): string {
    return isPrivate ? 'приватного' : 'публичного';
  }
}
