import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface CommitInfo {
  // Не все поля
  sha: string;
  created: string;
}

export class ReposCommitsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  getCommits({ projectName, repoName }: RepoOptions, sha: string): Promise<CommitInfo[]> {
    return step(`Получение списка коммитов репозитордля ${sha}`, async () => {
      const response = await this.get(`${projectName}/${repoName}/commits`, {
        params: { sha, stat: false, verification: false, files: false },
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  async getLastCommitSha(options: RepoOptions, sha: string): Promise<string> {
    const commits = await this.getCommits(options, sha);
    return commits[0].sha;
  }
}
