import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { BranchProtectionBodyZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export class ReposBranchProtectionsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createBranchProtection(
    { tenantId, projectName, repoName }: RepoOptions,
    options: BranchProtectionBodyZodType,
  ): Promise<BranchProtectionBodyZodType> {
    return step(`Создание защиты веток ${options.branch_name} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/branch_protections`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
