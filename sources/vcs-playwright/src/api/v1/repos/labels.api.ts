import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface LabelInfo {
  // Не все поля
  id: bigint;
  name: string;
  color: string;
  description: string;
}

interface LabelOptions {
  name: string;
  color: string;
  exclusive?: boolean;
  description?: string;
}

export class ReposLabelsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  createLabel({ projectName, repoName }: RepoOptions, options: LabelOptions): Promise<LabelInfo> {
    return step(`Создание метки ${options.name} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${projectName}/${repoName}/labels`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
