import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { CreateHookOptionZodType } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v1/repos';
import { step } from '@vcs-pw/test';

interface HookInfo {
  // Не все поля
  id: bigint;
}

export class ReposHooksBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  createHook({ projectName, repoName }: RepoOptions, options: CreateHookOptionZodType): Promise<HookInfo> {
    return step(`Создание webhook ${options.branch_filter} в репозитории ${repoName}`, async () => {
      const response = await this.post(
        `${projectName}/${repoName}/hooks`,
        { type: 'sourcecontrol', ...options },
        {
          validateStatus: isStatus(HttpStatusCode.Created),
        },
      );
      return response.data;
    });
  }
}
