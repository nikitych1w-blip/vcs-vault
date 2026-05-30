import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { PrCreationZodType, PrMergeZodType } from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { RepoOptions } from '@vcs-pw/api/web';
import { step } from '@vcs-pw/test';

interface DeclineOptions {
  message: string;
}

interface MergePayload {
  head_commit_id: string;
  merge_when_checks_succeed: boolean;
  force_merge: boolean;
  do: string;
  merge_title_field: string;
  merge_message_field: string;
  delete_branch_after_merge?: string;
}

export class PullsWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super(options);
  }

  changeTitle({ projectName, repoName }: RepoOptions, index: number, title: string) {
    return step(`Обновление заголовка в запросе на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/issues/${index}/title`, {
        form: { ...csrf, title },
        failOnStatusCode: true,
      });
    });
  }

  changeTargetBranch({ projectName, repoName }: RepoOptions, index: number, branch: string) {
    return step(`Обновление целевой ветки на ${branch} в запросе на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pull/${index}/target_branch`, {
        form: { ...csrf, target_branch: branch },
        failOnStatusCode: true,
      });
    });
  }

  createPull({ projectName, repoName }: RepoOptions, options: PrCreationZodType): Promise<void> {
    return step(`Создание запроса на слияние ${options.head}->${options.base} в репозитории ${repoName}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/compare/${options.base}...${options.head}`, {
        form: { ...csrf, ...this.toCreatePayload(options) },
        failOnStatusCode: true,
      });
    });
  }

  declinePull({ projectName, repoName }: RepoOptions, index: number, options?: DeclineOptions): Promise<void> {
    return step(`Отмена запроса на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/issues/${index}/comments`, {
        form: { ...csrf, ...this.toDeclinePayload(options) },
        failOnStatusCode: true,
      });
    });
  }

  reopenPull({ projectName, repoName }: RepoOptions, index: number, options?: DeclineOptions): Promise<void> {
    return step(`Переоткрытие запроса на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/issues/${index}/comments`, {
        form: { ...csrf, ...this.toReopenPayload(options) },
        failOnStatusCode: true,
      });
    });
  }

  mergePull(
    { projectName, repoName }: RepoOptions,
    index: number,
    options: Omit<PrMergeZodType, 'head_commit_id'> & { head_commit_id: string },
  ): Promise<void> {
    return step(`Слияние запроса на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pulls/${index}/merge`, {
        form: { ...csrf, ...this.toMergePayload(options) },
        failOnStatusCode: true,
      });
    });
  }

  deletePull({ projectName, repoName }: RepoOptions, index: number): Promise<void> {
    return step(`Удаление запроса на слияние #${index}`, async () => {
      const csrf = await this.csrfParam();
      await this.post(`${projectName}/${repoName}/pulls/${index}/delete`, {
        form: csrf,
        failOnStatusCode: true,
      });
    });
  }

  private toCreatePayload(options: PrCreationZodType) {
    return {
      title: options.title ?? '',
      content: options.body ?? '',

      label_ids: options.labels?.join(',') ?? '',
      milestone_id: String(options.milestone) ?? '',
      assignee_ids: options.assignees?.join(',') ?? '',
      redirect_after_creation: '',
    };
  }

  private toDeclinePayload(options?: DeclineOptions) {
    return {
      content: options?.message ?? '',
      status: 'close',
    };
  }

  private toReopenPayload(options?: DeclineOptions) {
    return {
      content: options?.message ?? '',
      status: 'reopen',
    };
  }

  private toMergePayload(options: Omit<PrMergeZodType, 'head_commit_id'> & { head_commit_id: string }): MergePayload {
    return {
      head_commit_id: options.head_commit_id,
      merge_when_checks_succeed: options.merge_when_checks_succeed ?? false,
      force_merge: options.force_merge ?? false,
      do: options.merge_method,
      merge_title_field: options.title ?? '',
      merge_message_field: options.message ?? '',
      delete_branch_after_merge: this.toCheckboxValue(options.delete_branch_after_merge),
    };
  }
}
