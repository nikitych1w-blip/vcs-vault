import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { RepoOptions } from '@vcs-pw/api/web';
import { step } from '@vcs-pw/test';

export class ArchiveWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super(options);
  }

  getArchive({ projectName, repoName }: RepoOptions, ref: string, format: string): Promise<Buffer> {
    return step(`Скачивание архива репозитория ${repoName} для ref '${ref}' в формате ${format}`, async () => {
      const response = await this.get(`${projectName}/${repoName}/archive/${ref}.${format}`, {
        failOnStatusCode: true,
      });
      return response.body();
    });
  }
}
