import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface MilestoneInfo {
  // Не все поля
  id: bigint;
  title: string;
  state: 'open' | 'closed';
  due_on: string;
  description: string;
}

interface MilestoneOptions {
  title: string;
  state?: 'open' | 'closed';
  due_on?: string;
  description?: string;
}

export class ReposMilestonesBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  createMilestone({ projectName, repoName }: RepoOptions, options: MilestoneOptions): Promise<MilestoneInfo> {
    return step(`Создание этапа ${options.title} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${projectName}/${repoName}/milestones`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }
}
