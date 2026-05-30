import { BackApi, AxiosClientOptions, isStatus, HttpStatusCode } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';
import { RepoOptions } from '@vcs-pw/api/v1/repos';

interface PullReviewInfo {
  // Не все поля
  id: number;
}

interface PullReviewCommentInfo {
  // Не все поля
  id: number;
}

export class ReposReviewsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v1/repos',
    });
  }

  getReviews({ projectName, repoName }: RepoOptions, pullIndex: number): Promise<PullReviewInfo[]> {
    return step(`Получение списка ревью запроса на слияние #${pullIndex}`, async () => {
      const response = await this.get(`${projectName}/${repoName}/pulls/${pullIndex}/reviews`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getReviewComments(
    { projectName, repoName }: RepoOptions,
    pullIndex: number,
    reviewId: number,
  ): Promise<PullReviewCommentInfo[]> {
    return step(`Получение списка комментариев ревью в запросе на слияние #${pullIndex}`, async () => {
      const response = await this.get(`${projectName}/${repoName}/pulls/${pullIndex}/reviews/${reviewId}/comments`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
