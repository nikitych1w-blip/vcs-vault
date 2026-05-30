import { randomBytes } from 'crypto';
import { join } from 'path';

import { Faker } from '@faker-js/faker';
import { APIRequestContext } from '@playwright/test';

import {
  CommitStatusCreateRequestZodType,
  PrCreationZodType as CreatePullV3Options,
  RepoCreateZodType as CreateRepoV3Options,
  PrInfoZodType,
  RepositoryV3ZodType,
} from '@vcs-pw/api/generated/types/api/v3/zod.gen';
import { CreateProjectOptions as CreateOwProjectOptions } from '@vcs-pw/api/ow/v3/projects.api';
import { ProjectsBackApi as ProjectsInternalBackApi } from '@vcs-pw/api/sbt/internal/projects.api';
import { UsersTokensBackApi } from '@vcs-pw/api/v1/users/tokens.api';
import { AdminUsersKeysBackApi } from '@vcs-pw/api/v2/admin/users/keys.api';
import { AdminUsersBackApi, CreateUserOptions } from '@vcs-pw/api/v2/admin/users/users.api';
import {
  CreateProjectOptions,
  ProjectOptions as ProjectOptionsV2,
  ProjectsBackApi,
  Visibility,
} from '@vcs-pw/api/v2/projects/projects.api';
import { CreateRepoOptions as CreateRepoV2Options, ProjectsReposBackApi } from '@vcs-pw/api/v2/projects/repos.api';
import { CreateTenantOptions, TenantsBackApi } from '@vcs-pw/api/v2/tenants.api';
import { ProjectOptions as ProjectOptionsV3, RepoOptions } from '@vcs-pw/api/v3';
import { ReposBackApi as ReposV3BackApi } from '@vcs-pw/api/v3/repos/repos.api';
import { CreateRepoOptions as CreateRepoWebV1Options } from '@vcs-pw/api/web/v1/repo/repo.api';

import { CreateHookOptionZodType } from '@vcs-pw/api/generated/types/api/v2/zod.gen';
import { RepositorySubscriptionZodType } from '@vcs-pw/api/generated/types/web/bundle/zod.gen';
import { Config } from '@vcs-pw/config';
import { ApiRegistry } from '@vcs-pw/services/api.service';
import { DatabaseService } from '@vcs-pw/services/database.service';
import FileSystemService from '@vcs-pw/services/file.service';
import GitService, { GitWrapper } from '@vcs-pw/services/git.service';
import { SshKeyPair, SshKeyPairService } from '@vcs-pw/services/ssh.service';
import { step } from '@vcs-pw/test';
import { expect } from '@vcs-pw/test/ext';
import CleanupStack from '@vcs-pw/types/cleanup.type';
import { User } from '@vcs-pw/types/user.type';
import { getOr, getRandomElement } from '@vcs-pw/utils/object.util';

const CYRILLIC_LOWER_CHARS: readonly string[] = [...'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'];
const CYRILLIC_UPPER_CHARS: readonly string[] = [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
const UPPER_CHARS: readonly string[] = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
const LOWER_CHARS: readonly string[] = [...'abcdefghijklmnopqrstuvwxyz'];
export const DIGIT_CHARS: readonly string[] = [...'0123456789'];
export const LATIN_CHARS: readonly string[] = [...LOWER_CHARS, ...UPPER_CHARS];
export const CYRILLIC_CHARS: readonly string[] = [...CYRILLIC_LOWER_CHARS, ...CYRILLIC_UPPER_CHARS];
export const ALPHANUMERIC_CHARS: readonly string[] = [...LATIN_CHARS, ...DIGIT_CHARS];

export const ALL_CHARS = [...ALPHANUMERIC_CHARS, ...CYRILLIC_CHARS, ...' -_.!?*()[]{}\'"`~|\\/@#'];

export const SPECIAL_REPO_NAME_CHARACTERS: readonly string[] = [...'-_.'];
export const VALID_REPO_NAME_CHARACTERS: readonly string[] = [...ALPHANUMERIC_CHARS, ...SPECIAL_REPO_NAME_CHARACTERS];
export const README_DEFAULT = 'Default';

const COMMIT_STATUSES = ['pending', 'success', 'error', 'failure', 'warning'] as const;
const WEBHOOK_EVENTS = [
  'create',
  'delete',
  'fork',
  'push',
  'pull_request',
  'pull_request_assign',
  'pull_request_label',
  'pull_request_milestone',
  'pull_request_comment',
  'pull_request_review_approved',
  'pull_request_review_rejected',
  'pull_request_review_comment',
  'pull_request_sync',
  'repository',
  'release',
  'rebuild',
] as const;

export class DataGenerator {
  constructor(readonly faker: Faker) {}

  dirPath(): string {
    const numDirs = this.faker.number.int({ min: 0, max: 5 });

    return Array.from(
      { length: numDirs },
      () => this.faker.system.directoryPath().split('/').pop() || this.faker.word.noun().toLowerCase(),
    ).join('/');
  }

  filePath(): string {
    const fileName = this.faker.system.fileName();
    const dirPath = this.dirPath();
    return join(dirPath, fileName);
  }

  stringContent(): string {
    return this.faker.lorem.paragraphs({ min: 1, max: 10 });
  }

  // Во избежание flaky: имя ветки может повторяться через faker
  gitBranch(): string {
    return `${this.faker.git.branch()}-${this.faker.number.int()}`;
  }

  binaryContent(sizeInBytes?: number): Buffer<ArrayBuffer> {
    const bytesCount = sizeInBytes ?? this.faker.number.int({ min: 100, max: 10000 });
    return randomBytes(bytesCount);
  }

  createTenantRequest(): CreateTenantOptions {
    return {
      tenant_key: this.faker.string.alphanumeric({ length: { min: 10, max: 50 } }),
      name: this.faker.string.alphanumeric({ length: { min: 10, max: 50 } }),
    };
  }

  randomBoolean(): boolean {
    return this.faker.datatype.boolean();
  }

  uuid(): string {
    return this.faker.string.uuid();
  }

  maybe<T>(valueSupplier: () => T): T | undefined {
    return this.randomBoolean() ? valueSupplier() : undefined;
  }

  createRepoWebV1Request(projectId: number, options?: Partial<CreateRepoWebV1Options>): CreateRepoWebV1Options {
    const autoInit = getOr(options, 'autoInit', () => this.randomBoolean());
    return {
      projectId: projectId,
      private: getOr(options, 'private', () => this.randomBoolean()),
      name: options?.name ?? this.faker.string.alphanumeric({ length: { min: 10, max: 100 } }),
      description: getOr(options, 'description', () => this.faker.lorem.paragraph()),
      defaultBranch: options?.defaultBranch ?? this.gitBranch(),
      autoInit: autoInit,
      gitignores: getOr(options, 'gitignores', () =>
        this.randomBoolean() ? this.faker.helpers.arrayElement(['Python', 'Go']) : null,
      ),
      issueLabels: getOr(options, 'issueLabels', () =>
        this.randomBoolean() ? this.faker.helpers.arrayElement(['Advanced', 'Default']) : null,
      ),
      license: getOr(options, 'license', () =>
        this.randomBoolean() ? this.faker.helpers.arrayElement(['MIT', 'Apache-2.0']) : null,
      ),
      readme: 'Default',
      template: getOr(options, 'template', () => null),
      repoTemplate: getOr(options, 'repoTemplate', () => null),
      trustModel: 'default',
    };
  }

  createProjectV2Request(tenantKey: string, options?: Partial<CreateProjectOptions>): CreateProjectOptions {
    return {
      tenant_key: tenantKey,
      visibility: options?.visibility ?? this.faker.helpers.arrayElement([Visibility.LIMITED, Visibility.PRIVATE]),
      project_key: options?.project_key ?? this.uuid(),
      description: getOr(options, 'description', () => this.faker.string.sample({ min: 0, max: 255 })),
      name: options?.name ?? this.uuid(),
    };
  }

  createRepoV2Request(
    { tenant_key, project_key }: ProjectOptionsV2,
    options?: Partial<CreateRepoV2Options>,
  ): CreateRepoV2Options {
    return {
      tenant_key: tenant_key,
      project_key: project_key,
      private: options?.private ?? this.randomBoolean(),
      repository_key: options?.repository_key ?? this.faker.string.alphanumeric({ length: { min: 1, max: 255 } }),
      name: options?.name ?? this.faker.string.alphanumeric({ length: { min: 10, max: 100 } }),
      description: getOr(options, 'description', () => this.faker.lorem.paragraph()),
      default_branch: getOr(options, 'default_branch', () => this.gitBranch()),
    };
  }

  createUserV2Request(options?: Partial<CreateUserOptions>): CreateUserOptions {
    return {
      user_key: options?.user_key ?? this.faker.string.alphanumeric({ length: { min: 10, max: 255 } }),
      name: options?.name ?? this.uuid(),
      email: options?.email ?? this.faker.internet.email(),
      full_name: options?.full_name ?? this.faker.person.fullName(),
    };
  }

  createRepoV3Request(options?: Partial<CreateRepoV3Options>, canHaveUndefinedValues = true): CreateRepoV3Options {
    const randomBoolean = () => this.randomBoolean();
    const canBeUndefined = () => canHaveUndefinedValues && randomBoolean();
    const randomNullableValue = (valueSupplier: any) =>
      canBeUndefined() ? (randomBoolean() ? valueSupplier() : undefined) : valueSupplier();
    const autoInit = options?.auto_init ?? randomNullableValue(randomBoolean);
    return {
      name: options?.name ?? this.faker.string.fromCharacters(VALID_REPO_NAME_CHARACTERS, { min: 1, max: 100 }),
      auto_init: autoInit,
      private: options?.private ?? randomNullableValue(randomBoolean),
      description: getOr(options, 'description', () => randomNullableValue(this.faker.lorem.paragraph)),
      default_branch: getOr(options, 'default_branch', () => randomNullableValue(this.faker.git.branch)),
      gitignores: getOr(options, 'gitignores', () =>
        randomNullableValue(() => this.faker.helpers.arrayElement(['Python', 'Go'])),
      ),
      issue_labels: getOr(options, 'issue_labels', () =>
        randomNullableValue(() => this.faker.helpers.arrayElement(['Advanced', 'Default'])),
      ),
      license: getOr(options, 'license', () =>
        randomNullableValue(() => this.faker.helpers.arrayElement(['BSD-2-Clause', 'NCSA', 'Apache-2.0'])),
      ),
      readme: getOr(options, 'readme', () => (autoInit ? README_DEFAULT : randomNullableValue(() => README_DEFAULT))),
      template: getOr(options, 'template', () => randomNullableValue(randomBoolean)),
    };
  }

  createPullRequest(
    options: Omit<CreatePullV3Options, 'title'> & Partial<Pick<CreatePullV3Options, 'title'>>,
  ): CreatePullV3Options {
    const randomBoolean = () => this.randomBoolean();
    return {
      title: options.title ?? this.faker.string.alphanumeric({ length: { min: 2, max: 100 } }), // Дефект: должен мин 1
      head: options.head,
      base: options.base,
      body:
        options?.body ??
        (randomBoolean() ? this.faker.string.alphanumeric({ length: { min: 1, max: 512 } }) : undefined),
      assignees: options.assignees,
      reviewers: options.reviewers,
      labels: options.labels,
      milestone: options.milestone,
      due_date: options.due_date,
    };
  }

  subscribeRepoRequest(options?: Partial<RepositorySubscriptionZodType>): RepositorySubscriptionZodType {
    const randomBoolean = () => this.randomBoolean();
    return {
      is_watching: options?.is_watching ?? randomBoolean(),
      pull_review_request: options?.pull_review_request ?? randomBoolean(),
      pull_request_review: options?.pull_request_review ?? randomBoolean(),
      pull_review_dismiss: options?.pull_review_dismiss ?? randomBoolean(),
      new_pull_request: options?.new_pull_request ?? randomBoolean(),
      merge_pull_request: options?.merge_pull_request ?? randomBoolean(),
      pull_request_push_commits: options?.pull_request_push_commits ?? randomBoolean(),
      pull_request_code_comment: options?.pull_request_code_comment ?? randomBoolean(),
      email_notifications: options?.email_notifications ?? randomBoolean(),
    };
  }

  createCommitStatusRequest(options?: Partial<CommitStatusCreateRequestZodType>): CommitStatusCreateRequestZodType {
    return {
      context: options?.context ?? this.faker.lorem.word(),
      state: options?.state ?? getRandomElement(COMMIT_STATUSES),
      description: getOr(options, 'description', () => this.faker.lorem.sentence()),
      target_url: getOr(options, 'target_url', () => this.faker.internet.url()),
    };
  }

  createHookRequest(options?: Partial<CreateHookOptionZodType>): CreateHookOptionZodType {
    return {
      config: {
        content_type: options?.config?.content_type ?? 'json',
        url: options?.config?.content_type ?? this.faker.internet.url(),
        secret: options?.config?.secret,
      },
      events: [getRandomElement(WEBHOOK_EVENTS)],
      branch_filter: getOr(options, 'branch_filter', () => this.faker.git.branch()),
      authorization_header: options?.authorization_header,
      active: getOr(options, 'active', () => this.randomBoolean()),
    };
  }
}

/**
 * Класс для работы с основными сущностями: тенант, проект, репозиторий, пользователь
 * Сделано для удобства использования в тестах (автоматически при создании добавляет хук на удаление)
 * Использует самые распространенные варианты
 */
export class EntityManager {
  constructor(
    private readonly config: Config,
    readonly cleanup: CleanupStack,
    private readonly dataGenerator: DataGenerator,
    private readonly databaseService: DatabaseService,
    private readonly fileSystemService: FileSystemService,
    private readonly sshKeyPairService: SshKeyPairService,
    private readonly gitService: GitService,
    private readonly apiRegistry: ApiRegistry,
    private readonly projectsInternalApi: ProjectsInternalBackApi,
    private readonly usersTokensV1Api: UsersTokensBackApi,
    private readonly tenantsV2Api: TenantsBackApi,
    private readonly projectsV2Api: ProjectsBackApi,
    private readonly projectsReposV2Api: ProjectsReposBackApi,
    private readonly adminUsersKeysV2Api: AdminUsersKeysBackApi,
    private readonly adminUsersV2Api: AdminUsersBackApi,
    private readonly reposV3Api: ReposV3BackApi,
  ) {}

  // --- Тенанты --- //
  async createTenantV2() {
    const request = this.dataGenerator.createTenantRequest();
    const tenantInfo = await this.tenantsV2Api.createTenant(request);

    this.cleanup.push(() => this.tenantsV2Api.deleteTenant({ tenant_key: request.tenant_key }));

    return tenantInfo;
  }

  // --- Проекты --- //
  async createOneWorkProject(
    request: APIRequestContext,
    tenantKey: string,
    tools?: string[],
  ): Promise<CreateOwProjectOptions> {
    const owConfig = this.config.ow!;
    const api = new this.apiRegistry.ow.v3.projects({ client: request, baseUrl: owConfig.baseUrl });

    const key = this.dataGenerator.faker.string.alphanumeric({
      length: { min: 5, max: 8 },
    });
    const payload = {
      parentId: `/${tenantKey}`,
      bundleKey: 'base',
      projectKey: key,
      ownerLogin: owConfig.coordinator.name,
      description: 'Created by SC AT',
      projectName: key,
      tools: (tools ?? [owConfig.tools.sc]).map((tool) => ({ toolKey: tool })),
    };

    await api.createProject(payload);

    // Проект в SC появляется с задержкой
    await expect
      .poll(
        async () => {
          try {
            const project = await this.projectsV2Api.getProject({
              tenant_key: tenantKey,
              project_key: key,
            });
            return project?.id;
          } catch {
            return;
          }
        },
        {
          message: `Проект ${key} существует в SC`,
          timeout: owConfig.poll.timeout,
          intervals: [owConfig.poll.interval],
        },
      )
      .toBeTruthy();

    this.cleanup.push(() =>
      api.deleteProject({
        tenantKey,
        projectKey: key,
      }),
    );

    return payload;
  }

  async createProjectV2(tenantKey: string, options?: Partial<CreateProjectOptions>) {
    const request = this.dataGenerator.createProjectV2Request(tenantKey, options);
    const projectInfo = await this.projectsV2Api.createProject(request);

    this.cleanup.push(() =>
      this.projectsInternalApi.deleteProject({
        org_key: tenantKey,
        project_key: projectInfo.project_key,
      }),
    );

    return { ...request, ...projectInfo };
  }

  createLimitedProjectV2(tenantKey: string) {
    return this.createProjectV2(tenantKey, { visibility: Visibility.LIMITED });
  }

  createPrivateProjectV2(tenantKey: string) {
    return this.createProjectV2(tenantKey, { visibility: Visibility.PRIVATE });
  }

  // --- Репозитории --- //
  async createRepoWebV1(
    request: APIRequestContext,
    { tenantId, projectName, projectId }: ProjectOptionsV3 & { projectId: number },
  ) {
    const payload = this.dataGenerator.createRepoWebV1Request(projectId);

    const api = this.apiRegistry.web.v1.repo.repo.withRequest(request);
    await api.createRepo(payload);

    this.addDeleteRepoHook({
      tenantId: tenantId,
      projectName: projectName,
      repoName: payload.name,
    });

    return payload;
  }

  async createRepoV2(tenantId: string, projectOptions: ProjectOptionsV2, options?: Partial<CreateRepoV2Options>) {
    const request = this.dataGenerator.createRepoV2Request(projectOptions, options);
    const repoInfo = await this.projectsReposV2Api.createRepo(request);

    const projectName = repoInfo.uri.split('/')[1]; // format: /{projectName}/{repoName} -> ['', projectName, repoName]
    this.addDeleteRepoHook({
      tenantId: tenantId,
      projectName: projectName,
      repoName: request.name!,
    });

    return { ...repoInfo, description: request.description };
  }

  async createRepoV3(projectOptions: ProjectOptionsV3, options?: Partial<CreateRepoV3Options>) {
    const request = this.dataGenerator.createRepoV3Request(options);
    const repoInfo = await this.reposV3Api.createRepo(projectOptions, request);

    this.addDeleteRepoHook({
      ...projectOptions,
      repoName: repoInfo.name,
    });

    return { ...request, ...repoInfo };
  }

  addDeleteRepoHook(repoOptions: RepoOptions) {
    this.cleanup.push(() => this.reposV3Api.deleteRepo(repoOptions));
  }

  // --- Токены --- //
  async createAccessTokenV1(username: string, scopes: string[]) {
    const tokenName = `${username}-${this.dataGenerator.uuid()}`;
    const token = await this.usersTokensV1Api.createToken(username, { name: tokenName, scopes: scopes });

    this.addDeleteTokenHook(username, tokenName);
    return token.sha1;
  }

  addDeleteTokenHook(username: string, tokenName: string) {
    this.cleanup.push(() => this.usersTokensV1Api.deleteTokenByName(username, tokenName));
  }

  // --- Пользователи --- //
  async createUserV2() {
    const request = this.dataGenerator.createUserV2Request();
    return await this.adminUsersV2Api.createUser(request);

    // TODO: сейчас нет работающей ручки для удаления. Добавить очистку после
  }

  // --- Ключи --- //
  async addSshKeyV2(userLoginName: string, key: string) {
    const title = `ssh-key-${this.dataGenerator.uuid()}`;
    const request = { title, key };
    await this.adminUsersKeysV2Api.addKey(userLoginName, request);

    this.addDeleteKeyHook(userLoginName, title);
  }

  addDeleteKeyHook(userLogin: string, title: string) {
    this.cleanup.push(() => this.adminUsersKeysV2Api.deleteKey(userLogin, title));
  }

  async generateAndAddSshKey(userLoginName: string): Promise<SshKeyPair> {
    const sshPair = await this.sshKeyPairService.generateSshKeyPair();
    const publicKeyValue = await this.fileSystemService.readFile(sshPair.publicKeyPath);
    await this.addSshKeyV2(userLoginName, publicKeyValue);
    return sshPair;
  }

  async waitForRepoUpdateAfterAction(repoOptions: RepoOptions, action: () => Promise<any>) {
    const repoInfo = await this.reposV3Api.getRepo(repoOptions);
    await action();
    await this.reposV3Api.waitForUpdatedGreaterThan(repoOptions, repoInfo.updated_at);
  }

  // --- Запросы на слияние --- //
  async generateAndCreatePullRequest(
    repoOptions: RepoOptions,
    repoInfo: RepositoryV3ZodType,
    user: User,
    git?: GitWrapper,
  ): Promise<[PrInfoZodType, GitWrapper]> {
    if (!git) {
      git = await step('Клонирование репозитория', async () => {
        const git = await this.gitService.getConfiguredGit(user);
        const cloneResult = await git.clone(repoInfo.links.clone);
        expect(cloneResult).toBeOk();

        return git;
      });
    }

    return step('Создание запроса на слияние с отведением отдельной ветки с коммитом', async () => {
      const repoInfo = await this.reposV3Api.getRepo(repoOptions);

      const commitCount = 1;
      const branchName = this.dataGenerator.gitBranch();

      await this.waitForRepoUpdateAfterAction(repoOptions, async () => {
        const checkoutBranchResult = await git.checkoutBranch(branchName, repoInfo.default_branch);
        expect(checkoutBranchResult).toBeOk();

        const generateCommitsResult = await git.generateCommitsAndPush(commitCount);
        expect(generateCommitsResult).toBeOk();
      });

      const pullOptions = this.dataGenerator.createPullRequest({
        base: repoInfo.default_branch,
        head: branchName,
      });
      const pullsApi = this.apiRegistry.v3.repos.pulls.pulls.withBasic(user);
      const pullInfo = await pullsApi.createPull(repoOptions, pullOptions);

      const pulls = await pullsApi.getPulls(repoOptions);
      const pullIndex = pulls.pulls.length;

      // Проверка на конфликты производится с задержкой (отдельная фоновая горутина)
      await this.databaseService.repos.pulls.waitForCommitsAheadCount(repoOptions, pullIndex, commitCount);
      await this.databaseService.repos.pulls.waitForNonCheckingStatus(repoOptions, pullIndex);
      return [pullInfo, git];
    });
  }
}
