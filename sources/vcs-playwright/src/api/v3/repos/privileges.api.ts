import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import {
  AppliedPrivilegeStatusZodType,
  ApplyPrivilegeGroupsRequestZodType,
  UserPrivilegeZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions, expectNoApplyPrivilegeErrors } from '@vcs-pw/api/v3';

import { step } from '@vcs-pw/test';

export class ReposPrivilegesBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  getPrivilegeGroup({ tenantId, projectName, repoName }: RepoOptions, username: string): Promise<string | null> {
    return step(`Получение группы привилегий на репозиториий ${projectName} пользователя ${username}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/privileges`, {
        params: {
          username,
        },
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data?.[0]?.privilege_group ?? null;
    });
  }

  applyPrivilegeGroups(
    { tenantId, projectName, repoName }: RepoOptions,
    request: ApplyPrivilegeGroupsRequestZodType,
  ): Promise<AppliedPrivilegeStatusZodType> {
    return step(`Выдача/отзыв групп привилегий на репозиториий ${repoName}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/privileges`, request, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      const result = response.data;
      await expectNoApplyPrivilegeErrors(result);
      return result;
    });
  }

  grantPrivilegeGroups(
    options: RepoOptions,
    grantRequests: UserPrivilegeZodType[],
  ): Promise<AppliedPrivilegeStatusZodType> {
    const request: ApplyPrivilegeGroupsRequestZodType = {
      apply_privilege_groups: {
        grant: grantRequests,
      },
    };
    return this.applyPrivilegeGroups(options, request);
  }

  revokePrivilegeGroups(
    options: RepoOptions,
    revokeRequests: UserPrivilegeZodType[],
  ): Promise<AppliedPrivilegeStatusZodType> {
    const request: ApplyPrivilegeGroupsRequestZodType = {
      apply_privilege_groups: {
        revoke: revokeRequests,
      },
    };
    return this.applyPrivilegeGroups(options, request);
  }
}
