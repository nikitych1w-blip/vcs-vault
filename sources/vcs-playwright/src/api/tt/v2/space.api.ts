import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { IdDto } from '@vcs-pw/api/tt';
import { step } from '@vcs-pw/test';

export interface SpaceOptions {
  code: string;
  type: 'RUN' | 'CHANGE';
  name: string;
}

export class SpaceTaskTrackerApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'rest/api/space/v2',
    });
  }

  // Для вызова требуется привилегия space:write
  createSpace(options: SpaceOptions): Promise<IdDto> {
    return step(`TaskTracker: Создание пространства с кодом ${options.code}`, async () => {
      const response = await this.post('create', options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
