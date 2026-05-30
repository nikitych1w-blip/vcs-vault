import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

interface Version {
  version: string;
}

export class VersionBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/version',
    });
  }

  getVersion(): Promise<Version> {
    return step('Получение версии', async () => {
      const response = await this.get('', {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
