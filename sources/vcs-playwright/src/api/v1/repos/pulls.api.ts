import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface PullInfo {
  // Не все поля
  id: number;
}

export class ReposPullsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  getPull({ projectName, repoName }: RepoOptions, index: number): Promise<PullInfo> {
    return step(`Получение запроса на слияние #${index}`, async () => {
      const response = await this.get(`${projectName}/${repoName}/pulls/${index}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
