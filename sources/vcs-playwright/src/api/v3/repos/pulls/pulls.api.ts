import { expect } from '@playwright/test';
import { AxiosClientOptions, BackApi, HttpStatusCode, isStatus } from '@vcs-pw/api/client';
import {
  PrCreationZodType,
  PrInfoZodType,
  PrPatchZodType,
  V3ListPullRequestsResponseZodType,
  V3ListPullRequestsDataZodType,
  PrMergeZodType,
  PrIssuesResponseZodType,
  IssueInfoResponseZodType,
  V3GetPrIssuesDataZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/v3';
import { config } from '@vcs-pw/config';
import { step } from '@vcs-pw/test';

interface DeclineOptions {
  message: string;
}

export class ReposPullsBackApi extends BackApi {
  constructor(options: AxiosClientOptions) {
    super({
      ...options,
      path: 'api/v3/repos',
    });
  }

  createPull({ tenantId, projectName, repoName }: RepoOptions, options: PrCreationZodType): Promise<PrInfoZodType> {
    return step(`Создание запроса на слияние ${options.head}->${options.base} в репозитории ${repoName}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/pulls`, options, {
        validateStatus: isStatus(HttpStatusCode.Created),
      });
      return response.data;
    });
  }

  updatePull(
    { tenantId, projectName, repoName }: RepoOptions,
    index: number | bigint,
    options: PrPatchZodType,
  ): Promise<PrInfoZodType> {
    return step(`Обновление запроса на слияние #${index}`, async () => {
      const response = await this.patch(`${tenantId}/${projectName}/${repoName}/pulls/${index}`, options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  changeTitle(repoOptions: RepoOptions, index: number, title: string): Promise<PrInfoZodType> {
    return this.updatePull(repoOptions, index, { title });
  }

  mergePull(
    { tenantId, projectName, repoName }: RepoOptions,
    index: number | bigint,
    options: PrMergeZodType,
  ): Promise<PrInfoZodType> {
    return step(`Слияние запроса на слияние #${index}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/pulls/${index}/merge`, options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  declinePull(
    { tenantId, projectName, repoName }: RepoOptions,
    index: number | bigint,
    options?: DeclineOptions,
  ): Promise<PrInfoZodType> {
    return step(`Отмена запроса на слияние #${index}`, async () => {
      const response = await this.post(`${tenantId}/${projectName}/${repoName}/pulls/${index}/decline`, options, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getPull({ tenantId, projectName, repoName }: RepoOptions, index: number): Promise<PrInfoZodType> {
    return step(`Получение запроса на слияние #${index}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/pulls/${index}`, {
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getPulls(
    { tenantId, projectName, repoName }: RepoOptions,
    query?: V3ListPullRequestsDataZodType['query'],
  ): Promise<V3ListPullRequestsResponseZodType> {
    return step(`Получение списка запросов на слияние в репозитории ${repoName}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/pulls`, {
        params: query,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  getIssues(
    { tenantId, projectName, repoName }: RepoOptions,
    index: number | bigint,
    query?: V3GetPrIssuesDataZodType['query'],
  ): Promise<PrIssuesResponseZodType> {
    return step(`Получение списка связанных задач в запросе на слияние #${index}`, async () => {
      const response = await this.get(`${tenantId}/${projectName}/${repoName}/pulls/${index}/issues`, {
        params: query,
        validateStatus: isStatus(HttpStatusCode.Ok),
      });
      return response.data;
    });
  }

  async expectIssuesCount(
    options: RepoOptions,
    pullIndex: number | bigint,
    expectedCount: number,
  ): Promise<IssueInfoResponseZodType[]> {
    let links: IssueInfoResponseZodType[] = [];
    await expect
      .poll(
        async () => {
          const response = await this.getIssues(options, pullIndex);
          links = response.issues ?? [];
          return links.length;
        },
        {
          message: `У PR #${pullIndex} количество связанных задач: ${expectedCount}`,
          timeout: config.tt!.poll.timeout,
          intervals: [config.tt!.poll.interval],
        },
      )
      .toEqual(expectedCount);
    return links;
  }
}
