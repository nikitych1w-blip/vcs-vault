import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import {
  CommitStatusCreateRequestZodType,
  CommitStatusInfoZodType,
  CommitStatusListResponseZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export class ReposCommitsStatusesBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createCommitStatus(
    { tenantId, projectName, repoName }: RepoOptions,
    sha: string,
    options: CommitStatusCreateRequestZodType,
  ): Promise<CommitStatusInfoZodType> {
    return step(`Создание статуса ${options.state} для коммита ${sha}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/commits/${sha}/statuses`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }

  getCommitStatuses(
    { tenantId, projectName, repoName }: RepoOptions,
    sha: string,
  ): Promise<CommitStatusListResponseZodType> {
    return step(`Получение списка статусов коммита ${sha}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/commits/${sha}/statuses`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
