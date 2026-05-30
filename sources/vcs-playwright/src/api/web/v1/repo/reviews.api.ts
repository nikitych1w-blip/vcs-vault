import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { RepoOptions } from '@vcs-pw/api/web';
import { step } from '@vcs-pw/test';

interface ReviewOptions {
  commit_id: string;
  content: string;
  type: 'comment' | 'reject' | 'approve';
}

export class ReviewsWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super(options);
  }

  private async createReview(
    { projectName, repoName }: RepoOptions,
    pullIndex: number,
    options: ReviewOptions,
  ): Promise<void> {
    const csrf = await this.csrfParam();
    await this.post(`${projectName}/${repoName}/pulls/${pullIndex}/files/reviews/submit`, {
      form: { ...csrf, ...options },
      failOnStatusCode: true,
    });
  }

  createCommentReview(
    repoOptions: RepoOptions,
    pullIndex: number,
    options: Omit<ReviewOptions, 'type'>,
  ): Promise<void> {
    return step(`Создание ревью-комментария в запросе на слияние #${pullIndex}`, () =>
      this.createReview(repoOptions, pullIndex, { ...options, type: 'comment' }),
    );
  }

  createApproveReview(
    repoOptions: RepoOptions,
    pullIndex: number,
    options: Omit<ReviewOptions, 'type'>,
  ): Promise<void> {
    return step(`Создание ревью-одобрения в запросе на слияние #${pullIndex}`, () =>
      this.createReview(repoOptions, pullIndex, { ...options, type: 'approve' }),
    );
  }

  createRejectReview(repoOptions: RepoOptions, pullIndex: number, options: Omit<ReviewOptions, 'type'>): Promise<void> {
    return step(`Создание ревью-отклонения в запросе на слияние #${pullIndex}`, () =>
      this.createReview(repoOptions, pullIndex, { ...options, type: 'reject' }),
    );
  }
}
