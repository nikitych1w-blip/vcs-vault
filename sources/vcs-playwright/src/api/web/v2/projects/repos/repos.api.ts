import { ReactWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { RepositorySubscriptionZodType } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/web';

export class ReposReactWebApi extends ReactWebApi {
  constructor(options: RequestClientOptions) {
    super({
      ...options,
      path: 'web/v2',
    });
  }

  subscribe({ projectName, repoName }: RepoOptions, body: RepositorySubscriptionZodType) {
    return step(`Обновление подписки на репозиторий ${repoName}`, () =>
      this.put(`projects/${projectName}/repos/${repoName}/subscribe`, { data: body, failOnStatusCode: true }),
    );
  }

  favorite({ projectName, repoName }: RepoOptions) {
    return step(`Добавление репозитория ${repoName} в избранное`, () =>
      this.post(`projects/${projectName}/repos/${repoName}/favorite`, {
        failOnStatusCode: true,
      }),
    );
  }
}
