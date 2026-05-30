import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { BranchCreationZodType, BranchItemZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export class ReposBranchesBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createBranch(
    { tenantId, projectName, repoName }: RepoOptions,
    options: BranchCreationZodType,
  ): Promise<BranchItemZodType> {
    return step(`Создание ветки ${options.new_branch} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/branches`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
