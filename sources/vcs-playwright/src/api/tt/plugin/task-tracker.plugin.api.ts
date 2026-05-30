import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { PagedDtoList } from '@vcs-pw/api/tt';
import { step } from '@vcs-pw/test';

export interface PullRequestInfo {
  id: number;
  url: string;
  status: string;
}

export class TaskTrackerPluginApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'extension/plugin/v2/rest/api/swtr_task_tracker_plugin/v1',
    });
  }

  getPulls(code: string): Promise<PagedDtoList<PullRequestInfo>> {
    return step(`TaskTracker: Получение списка PR для юнита ${code}`, async () => {
      const data = { filters: { units: [code] }, page: { page: 0, size: 100 } };
      const response = await this.post(`pull_request/find`, data, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
