import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import { CreateFileRequestZodType, V3CreateFileResponseZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

const CODEOWNERS_FILE_PATH = 'CODEOWNERS';
type CodeOwnerRules = Record<string, string[]>;

export class ReposContentsFileBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createFile(
    { tenantId, projectName, repoName }: RepoOptions,
    options: CreateFileRequestZodType,
  ): Promise<V3CreateFileResponseZodType> {
    return step(`Создание файла ${options.filepath} в репозитории ${repoName}`, async () => {
      const response = await this.post(
        `${tenantId}/${projectName}/${repoName}/contents/file/create`,
        {
          ...options,
          content: btoa(options.content),
        },
        {
          validateStatus: isStatus(HttpStatusCode.Created),
        },
      );
      return response.data;
    });
  }

  createCodeOwnersFile(repoOptions: RepoOptions, branch: string, rules: CodeOwnerRules) {
    return this.createFile(repoOptions, {
      filepath: CODEOWNERS_FILE_PATH,
      content: Object.entries(rules)
        .map(([path, users]) => `${path} ${users.map((user) => `@${user}`).join(' ')}`)
        .join('\n'),
      branch: branch,
      message: 'Add CODEOWNERS file',
    });
  }
}
