import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface RepoInfo {
  id: number;
}

interface RepoSettingOptions {
  allow_manual_merge?: boolean;
  allow_merge_commits?: boolean;
  allow_rebase?: boolean;
  allow_rebase_explicit?: boolean;
  allow_rebase_update?: boolean;
  allow_squash_merge?: boolean;
  archived?: boolean;
}

export class ReposBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  deleteRepo({ projectName, repoName }: RepoOptions): Promise<void> {
    return step(`Удаление репозитория ${repoName}`, async () => {
      await this.delete(`${projectName}/${repoName}`, {
        validateStatus: isStatus(HttpStatusCode.NoContent),
      });
    });
  }

  getRepo({ projectName, repoName }: RepoOptions): Promise<RepoInfo> {
    return step(`Получение репозитория ${repoName}`, async () => {
      const response = await this.get(`${projectName}/${repoName}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  editSettings({ projectName, repoName }: RepoOptions, settings: RepoSettingOptions): Promise<RepoInfo> {
    return step(`Обновление настроек репозитория ${repoName}`, async () => {
      const response = await this.patch(`${projectName}/${repoName}`, settings, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
