import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { RepoOptions } from '@vcs-pw/api/web';
import { step } from '@vcs-pw/test';

interface DiffCommentPayload {
  latest_commit_id: string;
  side: 'proposed' | 'previous';
  line: number;
  path: string;
  content: string;
  diff_start_cid?: string;
  diff_end_cid?: string;
  diff_base_cid?: string;
}

interface SingleDiffCommentPayload extends DiffCommentPayload {
  single_review: boolean;
}

interface ReviewDiffCommentPayload extends DiffCommentPayload {
  pending_review: string;
}

interface ReplySingleDiffCommentPayload extends SingleDiffCommentPayload {
  reply: number; // review_id
}

export class CommentsWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super(options);
  }

  createPullComment({ projectName, repoName }: RepoOptions, pullIndex: number, content: string): Promise<void> {
    return step(`Создание комментария в запросе на слияние #${pullIndex}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/issues/${pullIndex}/comments`, {
        form: { ...csrf, content, status: '' },
        failOnStatusCode: true,
      });
    });
  }

  createDiffComment(
    { projectName, repoName }: RepoOptions,
    pullIndex: number,
    options: SingleDiffCommentPayload,
  ): Promise<void> {
    return step(`Создание комментария к файлу ${options.path} в запросе на слияние #${pullIndex}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pulls/${pullIndex}/files/reviews/comments`, {
        form: { ...csrf, ...options, origin: 'diff' },
        failOnStatusCode: true,
      });
    });
  }

  createReviewComment(
    { projectName, repoName }: RepoOptions,
    pullIndex: number,
    options: ReviewDiffCommentPayload,
  ): Promise<void> {
    return step(`Создание комментария к файлу ${options.path} в запросе на слияние #${pullIndex}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pulls/${pullIndex}/files/reviews/comments`, {
        form: { ...csrf, ...options, origin: 'diff' },
        failOnStatusCode: true,
      });
    });
  }

  replyDiffComment(
    { projectName, repoName }: RepoOptions,
    pullIndex: number,
    options: ReplySingleDiffCommentPayload,
  ): Promise<void> {
    return step(`Ответ на комментария к файлу ${options.path} в запросе на слияние #${pullIndex}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pulls/${pullIndex}/files/reviews/comments`, {
        form: { ...csrf, ...options, origin: 'diff' },
        failOnStatusCode: true,
      });
    });
  }

  editComment({ projectName, repoName }: RepoOptions, index: number, content: string): Promise<void> {
    return step(`Редактирование комментария #${index} в репозитории ${repoName}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/comments/${index}`, {
        form: { ...csrf, content },
        failOnStatusCode: true,
      });
    });
  }

  deleteComment({ projectName, repoName }: RepoOptions, index: number): Promise<void> {
    return step(`Удаление комментария #${index} в репозитории ${repoName}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/comments/${index}/delete`, {
        form: { ...csrf },
        failOnStatusCode: true,
      });
    });
  }
}
