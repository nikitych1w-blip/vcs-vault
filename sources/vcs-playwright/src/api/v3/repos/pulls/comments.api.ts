import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import {
  PrCommentCreateOptionsZodType,
  CommentZodType,
  CommentListResponseZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { step } from '@vcs-pw/test';

export class ReposPullsCommentsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createComment(
    { tenantId, projectName, repoName }: RepoOptions,
    index: number,
    options: PrCommentCreateOptionsZodType,
  ): Promise<CommentZodType> {
    return step(`Создание комментария в запросе на слияние #${index}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/pulls/${index}/comments`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }

  getComments({ tenantId, projectName, repoName }: RepoOptions, index: number): Promise<CommentListResponseZodType> {
    return step(`Получение списка комментариев в запросе на слияние #${index}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/pulls/${index}/comments`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }
}
