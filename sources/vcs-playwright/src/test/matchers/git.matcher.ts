import { ExpectMatcherState, MatcherReturnType } from '@playwright/test';
import { GitResult } from '@vcs-pw/services/git.service';
import { isFileExists, resolve } from '@vcs-pw/utils/file.util';

export interface GitMatchers<R> extends Record<string, (this: ExpectMatcherState, ...args: any[]) => R | Promise<R>> {
  toBeOk<T>(gitResult: GitResult<T>): R;

  toExist(path: string, gitDir: string): Promise<R>;
}

export const gitMatcher: GitMatchers<MatcherReturnType> = {
  toBeOk<T>(gitResult: GitResult<T>) {
    const assertionName = 'toBeOk';

    const pass = gitResult.error === undefined;

    return {
      pass,
      message: () =>
        pass
          ? 'Ожидалось, что Git-операция завершится с ошибкой, но она прошла успешно'
          : [
              'Git-операция завершилась с ошибкой:',
              gitResult.error?.message,
              gitResult.error?.stack ? `\nStack: ${gitResult.error.stack}` : '',
            ].join('\n'),
      name: assertionName,
    };
  },

  async toExist(path: string, gitDir: string) {
    const assertionName = 'toExist';

    const pass = await isFileExists(resolve(gitDir, path));

    return {
      pass,
      message: () =>
        pass
          ? `Ожидалось, что существует в Git-репозитории файл: ${path}`
          : `Отсутствует файл в Git-репозитории: ${path}`,
      name: assertionName,
    };
  },
};
