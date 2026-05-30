import {
  BranchSummary,
  CleanMode,
  CleanSummary,
  CommitResult,
  FetchResult,
  InitResult,
  LogResult,
  MergeResult,
  Options,
  PullResult,
  PushResult,
  ResetMode,
  ResetOptions,
  simpleGit,
  SimpleGit,
  SimpleGitOptions,
  StatusResult,
  TaskOptions,
} from 'simple-git';

import { DataGenerator } from '@vcs-pw/services/data.service';
import FileSystemService from '@vcs-pw/services/file.service';
import { step } from '@vcs-pw/test';
import { SourceControlUser } from '@vcs-pw/types/user.type';
import { toUnixPath } from '@vcs-pw/utils/file.util';
import { log } from '@vcs-pw/logger';

export type GitResult<T> = GitResultSuccess<T> | GitResultError;
export interface GitResultSuccess<T> {
  result: T;
  error?: never;
}
export interface GitResultError {
  result?: never;
  error: Error;
}

interface FileDiff {
  added: number;
  deleted: number;
  binary: boolean;
  path: string;
}

/**
 * Сервис для инициализации и настройки Git-репозитория с пользовательскими учётными данными.
 * Предоставляет метод для получения предварительно сконфигурированного экземпляра Git,
 * настроенного для работы через HTTPS или SSH.
 */
export default class GitService {
  /**
   * Базовые параметры конфигурации для всех экземпляров SimpleGit.
   */
  private readonly globalOptions: Partial<SimpleGitOptions> = {
    binary: 'git',
    /**
     * Указывает, нужно ли обрезать пробельные символы в выводе команд Git (Только в git.raw!).
     */
    trimmed: true,
    // https://git-scm.com/docs/git-config#Documentation/git-config.txt-pushautoSetupRemote
    config: ['http.sslVerify=false', 'ssh.variant=ssh', 'push.autoSetupRemote=true'],
    unsafe: { allowUnsafeSshCommand: true },
  };

  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly dataGenerator: DataGenerator,
  ) {}

  /**
   * Возвращает настроенный экземпляр Git с учётными данными пользователя.
   *
   * Создаёт временную директорию и настраивает Git с указанными параметрами пользователя.
   * Если передан путь к приватному SSH-ключу, используется аутентификация по SSH.
   * В противном случае — аутентификация по логину и паролю через временный `credential.helper`.
   *
   * @param {SourceControlUser} user - Данные пользователя системы контроля версий.
   * @param {string} user.name - Имя пользователя, устанавливаемое в `user.name` конфига Git.
   * @param {string} user.email - Email пользователя, устанавливаемый в `user.email` конфига Git.
   * @param {string} user.password - Пароль пользователя, используемый при HTTPS-аутентификации.
   *
   * @param {string} [sshPrivateKeyPath] - Необязательный путь к приватному SSH-ключу.
   * Если указан, Git будет настроен на использование SSH-соединения с ключом.
   *
   * @returns {Promise<GitWrapper>} Промис, который резолвится в обёртку {@link GitWrapper},
   * содержащую экземпляр `simple-git`, временную директорию и конфигурацию.
   *
   * @throws {Error} Может выбросить ошибку, если не удастся создать временную директорию
   * или возникнет проблема при инициализации Git.
   *
   * @example
   * const git = await gitService.getConfiguredGit(
   *   { name: 'Алексей', email: 'alex@example.com', password: 'pass123' }
   * );
   *
   * @example
   * const git = await gitService.getConfiguredGit(
   *   { name: 'Алексей', email: 'alex@example.com', password: 'pass123' },
   *   '/home/user/.ssh/id_rsa'
   * );
   */
  async getConfiguredGit(
    { name, password, email }: SourceControlUser,
    sshPrivateKeyPath?: string,
  ): Promise<GitWrapper> {
    const tempDir = await this.fileSystemService.createTempDir();
    const config = [...this.globalOptions.config!, `user.name=${name}`, `user.email=${email}`];

    if (sshPrivateKeyPath) {
      config.push(`core.sshCommand=ssh \
      -o StrictHostKeyChecking=no \
      -o IdentitiesOnly=yes \
      -o AddKeysToAgent=no \
      -i "${toUnixPath(sshPrivateKeyPath)}"`);
    } else {
      config.push(`credential.helper=!f() { echo "username=${name}"; echo "password=${password}"; }; f`);
    }
    const git = simpleGit(tempDir, {
      ...this.globalOptions,
      baseDir: tempDir,
      config: config,
    });
    return new GitWrapper(git, tempDir, this.fileSystemService, this.dataGenerator);
  }
}

/**
 * Обёртка вокруг SimpleGit, предоставляющая удобные методы для выполнения Git-операций
 * с обработкой ошибок и логированием шагов.
 */
export class GitWrapper {
  /**
   * Создаёт экземпляр обёртки для работы с Git в указанной директории.
   *
   * @param {SimpleGit} git - Экземпляр SimpleGit, инкапсулирующий Git-команды.
   * @param {string} baseDir - Базовая директория, в которой будет выполняться команда git.
   */
  constructor(
    private readonly git: SimpleGit,
    private readonly baseDir: string,
    private readonly fileSystemService: FileSystemService,
    private readonly dataGenerator: DataGenerator,
  ) {}

  get dir(): string {
    return this.baseDir;
  }

  /**
   * Универсальный метод для безопасного выполнения Git-команд с перехватом исключений.
   *
   * @template T - Тип ожидаемого результата команды.
   * @param {() => Promise<T>} fn - Асинхронная функция, выполняющая Git-команду.
   * @returns {Promise<GitResult<T>>} Обёрнутый результат выполнения команды с возможной ошибкой.
   */
  private async runGitCommand<T>(fn: () => Promise<T>): Promise<GitResult<T>> {
    try {
      const result = await fn();
      log.info('Git: Результат выполнения', { result });
      return { result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Git: Ошибка выполнения', { error });
      return { error };
    }
  }

  async init(initialBranch: string, options?: string[]): Promise<GitResult<InitResult>> {
    return step('Git: Инициализация репозитория', () =>
      this.runGitCommand(() => this.git.init([...(options ?? []), `--initial-branch=${initialBranch}`, this.dir])),
    );
  }

  async addRemote(url: string, name = 'origin', options?: TaskOptions): Promise<GitResult<string>> {
    return step(`Git: Добавление remote '${name}'`, () =>
      this.runGitCommand(() => this.git.addRemote(name, url, options)),
    );
  }

  async clone(url: string, options?: TaskOptions): Promise<GitResult<string>> {
    return step('Git: Клонирование репозитория', () =>
      this.runGitCommand(() => this.git.clone(url, this.dir, options)),
    );
  }

  async fetch(branch: string, remote = 'origin', options?: TaskOptions): Promise<GitResult<FetchResult>> {
    return step('Git: Получение изменений', () => this.runGitCommand(() => this.git.fetch(remote, branch, options)));
  }

  async pull(remote?: string, branch?: string, options?: TaskOptions): Promise<GitResult<PullResult>> {
    return step('Git: Слияние изменений', () => this.runGitCommand(() => this.git.pull(remote, branch, options)));
  }

  async push(remote?: string, branch?: string, options?: TaskOptions): Promise<GitResult<PushResult>> {
    return step('Git: Отправка изменений', () => this.runGitCommand(() => this.git.push(remote, branch, options)));
  }

  async forcePush(remote?: string, branch?: string): Promise<GitResult<PushResult>> {
    return step('Git: Принудительная отправка изменений', () =>
      this.runGitCommand(() => this.git.push(remote, branch, ['-f'])),
    );
  }

  async pushTags(remote?: string, options?: TaskOptions): Promise<GitResult<PushResult>> {
    return step('Git: Отправка тегов', () => {
      const fn = remote ? () => this.git.pushTags(remote, options) : () => this.git.pushTags(options);
      return this.runGitCommand(fn);
    });
  }

  async status(options?: TaskOptions): Promise<GitResult<StatusResult>> {
    return step('Git: Проверка статуса', () => this.runGitCommand(() => this.git.status(options)));
  }

  async add(files: string | string[]): Promise<GitResult<string>> {
    return step('Git: Добавление файлов в индекс', () => this.runGitCommand(() => this.git.add(files)));
  }

  async commit(message?: string, files?: string | string[], options?: Options): Promise<GitResult<CommitResult>> {
    return step('Git: Создание коммита', () => {
      const mandatoryMessage = message ?? this.dataGenerator.faker.git.commitMessage();
      return this.runGitCommand(() => this.git.commit(mandatoryMessage, files, options));
    });
  }

  async checkout(what: string, options?: TaskOptions): Promise<GitResult<string>> {
    return step(`Git: Переключение на ref ${what}`, () => this.runGitCommand(() => this.git.checkout(what, options)));
  }

  async checkoutBranch(branch: string, startPoint: string): Promise<GitResult<void>> {
    return step(`Git: Создание и переключение на ветку ${branch}`, () =>
      this.runGitCommand(() => this.git.checkoutBranch(branch, startPoint)),
    );
  }

  async branch(options?: TaskOptions): Promise<GitResult<BranchSummary>> {
    return step('Git: Просмотр веток', () => this.runGitCommand(() => this.git.branch(options)));
  }

  async log(options?: TaskOptions): Promise<GitResult<LogResult>> {
    return step('Git: История коммитов', () => this.runGitCommand(() => this.git.log(options)));
  }

  async reset(mode: ResetMode, options?: TaskOptions<ResetOptions>): Promise<GitResult<string>> {
    return step('Git: Сброс изменений', () => this.runGitCommand(() => this.git.reset(mode, options)));
  }

  async clean(mode: CleanMode, options?: TaskOptions): Promise<GitResult<CleanSummary>> {
    return step('Git: Очистка неотслеживаемых файлов', () => this.runGitCommand(() => this.git.clean(mode, options)));
  }

  async addAnnotatedTag(tagName: string, tagMessage: string, ref?: string): Promise<GitResult<string>> {
    return step('Git: Создание аннотированного тега', () => {
      const args = ['-a', '-m', tagMessage, tagName];
      if (ref) {
        args.push(ref);
      }
      return this.runGitCommand(() => this.git.tag(args));
    });
  }

  async addTag(tagName: string, ref?: string): Promise<GitResult<string>> {
    return step('Git: Создание легковесного тега', () => {
      const args = [tagName];
      if (ref) {
        args.push(ref);
      }
      return this.runGitCommand(() => this.git.tag(args));
    });
  }

  async tag(): Promise<GitResult<string>> {
    return step('Git: Получение списка тегов', () => this.runGitCommand(() => this.git.tag()));
  }

  async firstCommit(): Promise<GitResult<string>> {
    return step('Git: Получение хэша первого коммита', () => this.runGitCommand(() => this.git.firstCommit()));
  }

  async diff(options?: TaskOptions): Promise<GitResult<string>> {
    return step('Git: Получение разницы', () => this.runGitCommand(() => this.git.diff(options)));
  }

  async show(options: TaskOptions): Promise<GitResult<string>> {
    return step('Git: Просмотр объекта', () => this.runGitCommand(() => this.git.show(options)));
  }

  async merge(options: TaskOptions): Promise<GitResult<MergeResult>> {
    return step('Git: Выполнение merge', () => this.runGitCommand(() => this.git.merge(options)));
  }

  async mergeNoFastForward(branch: string): Promise<GitResult<MergeResult>> {
    // Всегда создается merge-commit
    return this.merge(['--no-ff', branch]);
  }

  async remove(paths: string | string[]): Promise<GitResult<void>> {
    return step('Git: Удаление файла', () => this.runGitCommand(() => this.git.rm(paths)));
  }

  async addAllAndCommit(message?: string): Promise<GitResult<unknown>> {
    const addResult = await this.add('-A');
    if (addResult.error) {
      return addResult;
    }
    return this.commit(message);
  }

  async commitAllAndPush(message?: string): Promise<GitResultError | GitResult<PushResult>> {
    const commitResult = await this.addAllAndCommit(message);
    if (commitResult.error) {
      return commitResult;
    }
    return await this.push();
  }

  async amendCommitAndForcePush(message: string): Promise<GitResultError | GitResult<PushResult>> {
    const commitOptions = {
      '--amend': null,
      '--no-edit': null,
    };
    const commitResult = await this.commit(message, [], commitOptions);
    if (commitResult.error) {
      return commitResult;
    }
    return await this.forcePush();
  }

  async generateFilesAndPushAll(
    fileCount: number,
    message?: string,
  ): Promise<GitResultError | (GitResult<PushResult> & { files: string[] })> {
    return step(`Git: Создание ${fileCount} файлов и отправка всех изменений`, async () => {
      const files = await this.fileSystemService.generateRandomFiles(this.dir, fileCount);
      const pushResult = await this.commitAllAndPush(message);
      const relativePaths = files.map((file) => file.relativePath);
      return {
        ...pushResult,
        files: relativePaths,
      };
    });
  }

  async generateFilesAndAddToIndex(fileCount: number): Promise<GitResult<string>> {
    return step(`Git: Создание ${fileCount} файлов и добавление в индекс`, async () => {
      const files = await this.fileSystemService.generateRandomFiles(this.dir, fileCount);
      const relativePaths = files.map((file) => file.relativePath);
      return await this.add(relativePaths);
    });
  }

  async switchToOrphanBranch(orphanBranchName: string): Promise<GitResult<string>> {
    return step(`Git: Переключение на ветку-сироту ${orphanBranchName}`, () =>
      this.runGitCommand(() => this.git.raw('switch', '--orphan', orphanBranchName)),
    );
  }

  async getShaByRef(ref: string, options?: TaskOptions): Promise<GitResult<string>> {
    return step(`Git: Получение SHA для ref '${ref}'`, () => this.runGitCommand(() => this.git.revparse(ref, options)));
  }

  async getLastCommitSha(): Promise<GitResult<string>> {
    return this.getShaByRef('HEAD');
  }

  async getCommitMessage(ref: string): Promise<GitResult<string>> {
    return step(`Git: Получение сообщения коммита для ref '${ref}'`, () =>
      this.runGitCommand(() => this.git.raw('show', '-s', '--format=%B', ref)),
    );
  }

  async generateCommitsAndPush(
    count?: number,
  ): Promise<GitResult<{ commitCount: number; fileCount: number; files: string[] }>> {
    const commitCount = count ?? this.dataGenerator.faker.number.int({ min: 1, max: 5 });

    return await step(`Git: Создание и отправка ${commitCount} коммитов`, async () => {
      const files = new Set<string>();
      for (let i = 0; i < commitCount; i++) {
        const fileCount = this.dataGenerator.faker.number.int({ min: 2, max: 5 });

        const branchPushResult = await this.generateFilesAndPushAll(fileCount);
        if (branchPushResult.error) {
          return branchPushResult;
        }
        branchPushResult.files.forEach((file) => files.add(file));
      }
      return { result: { commitCount: commitCount, fileCount: files.size, files: [...files] } };
    });
  }

  async countLinesDiff(
    base: string,
    target: string,
    filePath?: string,
  ): Promise<GitResultSuccess<FileDiff[]> | GitResultError> {
    const options = ['--numstat', `${base}..${target}`];
    if (filePath) {
      options.push('--', toUnixPath(filePath));
    }
    const diffResult = await this.diff(options);

    if (diffResult.error) {
      return diffResult;
    }

    return {
      result: this.extractFileDiffs(diffResult.result),
    };
  }

  async countLinesDiffInSingleCommit(
    ref: string,
    filePath?: string,
  ): Promise<GitResultSuccess<FileDiff[]> | GitResultError> {
    const options = ['--numstat', '--pretty=format:', ref];
    if (filePath) {
      options.push('--', toUnixPath(filePath));
    }
    const showResult = await this.show(options);

    if (showResult.error) {
      return showResult;
    }

    return {
      result: this.extractFileDiffs(showResult.result),
    };
  }

  private extractFileDiffs(diffString: string): FileDiff[] {
    const fileDiffs = [];
    for (const line of diffString.split('\n')) {
      const [addedStr, deletedStr, file] = line.split('\t');
      if (!file) {
        continue;
      }
      let fileDiff: FileDiff;
      if (addedStr === '-' && deletedStr === '-') {
        fileDiff = {
          path: file,
          added: 0,
          deleted: 0,
          binary: true,
        };
      } else {
        fileDiff = {
          path: file,
          added: parseInt(addedStr, 10) || 0,
          deleted: parseInt(deletedStr, 10) || 0,
          binary: false,
        };
      }
      fileDiffs.push(fileDiff);
    }
    return fileDiffs;
  }
}
