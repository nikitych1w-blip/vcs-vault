import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

export class CacheBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/cache',
    });
  }

  reset(tenantId: string): Promise<void> {
    return step(`Сброс кэша для тенанта ${tenantId}`, () =>
      this.get(`${tenantId}/reset`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      }),
    );
  }
}
