import { OldWebApi, RequestClientOptions } from '@vcs-pw/api/client';
import { step } from '@vcs-pw/test';

export interface CreateRepoOptions {
  projectId: number;
  name: string;
  readme: string;
  defaultBranch: string;
  trustModel: 'default' | 'collaborator' | 'committer' | 'collaboratorcommitter';

  description?: string | null;
  private?: boolean | null;
  gitignores?: string | null;
  license?: string | null;
  issueLabels?: string | null;
  template?: boolean | null;
  autoInit?: boolean | null;
  repoTemplate?: string | null;
}

interface Payload {
  uid: number;
  repo_name: string;
  readme: string;
  default_branch: string;
  trust_model: string;

  description: string;
  repo_template: string;
  issue_labels: string;
  gitignores: string;
  license: string;

  private?: string;
  template?: string;
  auto_init?: string;
}

export class RepoWebApi extends OldWebApi {
  constructor(options: RequestClientOptions) {
    super({
      ...options,
      path: 'repo',
    });
  }

  createRepo(options: CreateRepoOptions): Promise<void> {
    return step(
      `Создание ${this.getVisibilityGenitiveLabel(options.private)} репозитория ${options.name}`,
      async () => {
        const csrf = await this.csrfParam();
        await this.post('create', {
          form: { ...csrf, ...this.toPayload(options) },
          failOnStatusCode: true,
        });
      },
    );
  }

  private getVisibilityGenitiveLabel(isPrivate: boolean | undefined | null): string {
    return isPrivate ? 'приватного' : 'публичного';
  }

  private toPayload(options: CreateRepoOptions): Payload {
    return {
      uid: options.projectId,
      repo_name: options.name,
      readme: options.readme,
      default_branch: options.defaultBranch,
      trust_model: options.trustModel,

      description: options.description ?? '',
      repo_template: options.repoTemplate ?? '',
      issue_labels: options.issueLabels ?? '',
      gitignores: options.gitignores ?? '',
      license: options.license ?? '',

      private: this.toCheckboxValue(options.private),
      template: this.toCheckboxValue(options.template),
      auto_init: this.toCheckboxValue(options.autoInit),
    };
  }
}
