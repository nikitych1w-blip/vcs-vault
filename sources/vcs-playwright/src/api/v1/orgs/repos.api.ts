import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { RepoCreateZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { step } from '@vcs-pw/test';

interface RepoInfo {
  name: string;
}

export class OrgsReposBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/orgs',
    });
  }

  createRepo(projectName: string, options: RepoCreateZodType): Promise<RepoInfo> {
    return step(
      `Создание ${this.getVisibilityGenitiveLabel(options.private)} репозитория ${options.name}`,
      async () => {
        const response = await this.post(`${projectName}/repos`, options, {
          validateStatus: isStatus(HttpStatusCode.Created),
        });
        return response.data;
      },
    );
  }

  private getVisibilityGenitiveLabel(isPrivate: boolean | null | undefined): string {
    return isPrivate ? 'приватного' : 'публичного';
  }
}
