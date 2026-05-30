import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { ReviewSettingsRequestZodType, BranchReviewSettingZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export class ReposReviewSettingsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createReviewSetting(
    { tenantId, projectName, repoName }: RepoOptions,
    options: ReviewSettingsRequestZodType,
  ): Promise<BranchReviewSettingZodType> {
    return step(`Создание настроек ревью ${options.branch_name} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/review_settings`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
