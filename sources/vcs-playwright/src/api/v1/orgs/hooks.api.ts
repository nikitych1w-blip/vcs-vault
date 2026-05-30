import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { CreateHookOptionZodType } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { step } from '@vcs-pw/test';

interface HookInfo {
  // Не все поля
  id: bigint;
}

export class OrgsHooksBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/orgs',
    });
  }

  createHook(projectName: string, options: CreateHookOptionZodType): Promise<HookInfo> {
    return step(`Создание webhook ${options.branch_filter} в проекте ${projectName}`, async () => {
      const response = await this.post(
        `${projectName}/hooks`,
        { type: 'sourcecontrol', ...options },
        {
          validateStatus: isStatus(HttpStatusCode.Created),
        },
      );
      return response.data;
    });
  }
}
